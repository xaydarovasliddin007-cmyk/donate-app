import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';
import 'api_exception.dart';

/// Thin wrapper around [Dio] that normalizes every failure into an
/// [ApiException], attaches the access token to every request, and
/// transparently refreshes it once on a 401 before giving up.
///
/// The access token is cached in memory (only touching secure storage on
/// login/refresh/logout) so it isn't re-read from the Keystore on every
/// single request — startup/navigation speed is a priority for this app.
class ApiClient {
  ApiClient({required this.tokenStorage, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
            ),
          ) {
    _dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(requestBody: true, responseBody: true),
      );
    }
  }

  final SecureStorageService tokenStorage;
  final Dio _dio;

  String? _accessToken;
  Future<bool>? _refreshing;

  /// Called once a refresh attempt has definitively failed — the caller
  /// (AuthController) should reset the app to guest state.
  void Function()? onSessionExpired;

  void setAccessToken(String? token) => _accessToken = token;

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (_accessToken != null) {
      options.headers['Authorization'] = 'Bearer $_accessToken';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final isUnauthorized = error.response?.statusCode == 401;
    final isRefreshCall = error.requestOptions.path.contains('/auth/refresh');
    final alreadyRetried = error.requestOptions.extra['retried'] == true;

    if (isUnauthorized && !isRefreshCall && !alreadyRetried) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        final retryOptions = error.requestOptions;
        retryOptions.headers['Authorization'] = 'Bearer $_accessToken';
        retryOptions.extra['retried'] = true;
        try {
          final response = await _dio.fetch(retryOptions);
          return handler.resolve(response);
        } on DioException catch (retryError) {
          return handler.next(retryError);
        }
      } else {
        await tokenStorage.clear();
        _accessToken = null;
        onSessionExpired?.call();
      }
    }

    handler.next(error);
  }

  Future<bool> _tryRefresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await tokenStorage.readRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data!;
      final newAccessToken = data['accessToken'] as String;
      final newRefreshToken = data['refreshToken'] as String;
      _accessToken = newAccessToken;
      await tokenStorage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) => _request(
    () => _dio.get<Map<String, dynamic>>(path, queryParameters: query),
  );

  Future<Map<String, dynamic>> post(String path, {Object? body}) =>
      _request(() => _dio.post<Map<String, dynamic>>(path, data: body));

  Future<Map<String, dynamic>> patch(String path, {Object? body}) =>
      _request(() => _dio.patch<Map<String, dynamic>>(path, data: body));

  Future<Map<String, dynamic>> put(String path, {Object? body}) =>
      _request(() => _dio.put<Map<String, dynamic>>(path, data: body));

  Future<Map<String, dynamic>> delete(String path) =>
      _request(() => _dio.delete<Map<String, dynamic>>(path));

  Future<Map<String, dynamic>> _request(
    Future<Response<Map<String, dynamic>>> Function() call,
  ) async {
    try {
      final response = await call();
      return response.data ?? const {};
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  ApiException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }

    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final error = data['error'] as Map;
      return ApiException(
        code: error['code'] as String? ?? 'UNKNOWN_ERROR',
        message: error['message'] as String? ?? 'Something went wrong',
        statusCode: e.response?.statusCode,
        details: error['details'],
      );
    }

    return ApiException.unknown(e);
  }
}
