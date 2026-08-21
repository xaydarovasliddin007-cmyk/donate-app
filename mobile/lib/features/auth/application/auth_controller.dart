import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/network/api_client_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../data/auth_api.dart';
import '../data/google_sign_in_service.dart';
import '../domain/app_user.dart';

final googleSignInServiceProvider = Provider<GoogleSignInService>(
  (ref) => GoogleSignInService(),
);

enum AuthStatus { guest, authenticated }

class AuthState {
  const AuthState({required this.status, this.user});

  final AuthStatus status;
  final AppUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  static const guest = AuthState(status: AuthStatus.guest);
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(apiClientProvider)),
);

class AuthController extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final apiClient = ref.watch(apiClientProvider);
    // Wired once per ApiClient instance: if a background token refresh ever
    // definitively fails, drop the app back to guest state immediately.
    apiClient.onSessionExpired = () => state = const AsyncData(AuthState.guest);

    final storage = ref.watch(secureStorageServiceProvider);
    final accessToken = await storage.readAccessToken();
    if (accessToken == null) {
      return AuthState.guest;
    }

    apiClient.setAccessToken(accessToken);
    try {
      final user = await ref.read(authApiProvider).me();
      return AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await storage.clear();
      apiClient.setAccessToken(null);
      return AuthState.guest;
    }
  }

  Future<void> _applyAuthResult(AuthResult result) async {
    await ref
        .read(secureStorageServiceProvider)
        .saveTokens(
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        );
    ref.read(apiClientProvider).setAccessToken(result.accessToken);
    state = AsyncData(
      AuthState(status: AuthStatus.authenticated, user: result.user),
    );
  }

  Future<void> login({required String email, required String password}) async {
    final result = await ref
        .read(authApiProvider)
        .login(email: email, password: password);
    await _applyAuthResult(result);
  }

  Future<void> register({
    required String email,
    required String password,
    String? displayName,
    required String locale,
  }) async {
    final result = await ref
        .read(authApiProvider)
        .register(
          email: email,
          password: password,
          displayName: displayName,
          locale: locale,
        );
    await _applyAuthResult(result);
  }

  /// Refreshes the cached user after a successful email verification, so
  /// [AuthState.user.isEmailVerified] flips without a full re-login.
  Future<void> refreshUser() async {
    final user = await ref.read(authApiProvider).me();
    final current = state.value;
    if (current == null) return;
    state = AsyncData(AuthState(status: current.status, user: user));
  }

  Future<void> verifyEmail(String code) async {
    await ref.read(authApiProvider).verifyEmail(code);
    await refreshUser();
  }

  Future<void> resendVerification() =>
      ref.read(authApiProvider).resendVerification();

  /// Returns true on success, false if the user cancelled the Google
  /// account picker (not an error — callers should just stay put silently).
  Future<bool> signInWithGoogle() async {
    if (!AppConfig.isGoogleSignInConfigured) {
      throw ApiException.googleNotConfigured();
    }

    final idToken = await ref.read(googleSignInServiceProvider).signIn();
    if (idToken == null) {
      return false;
    }

    final locale = ref.read(localeControllerProvider).languageCode;
    final result = await ref
        .read(authApiProvider)
        .googleAuth(idToken: idToken, locale: locale);
    await _applyAuthResult(result);
    return true;
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageServiceProvider);
    final refreshToken = await storage.readRefreshToken();
    if (refreshToken != null) {
      try {
        await ref.read(authApiProvider).logout(refreshToken);
      } catch (_) {
        // Best-effort server-side revocation — local logout must proceed regardless.
      }
    }
    await storage.clear();
    ref.read(apiClientProvider).setAccessToken(null);
    state = const AsyncData(AuthState.guest);
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
