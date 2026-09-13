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
  bool get isGuest => (user?.isGuest ?? true) || status == AuthStatus.guest;

  static const guest = AuthState(status: AuthStatus.guest);
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(apiClientProvider)),
);

class AuthController extends AsyncNotifier<AuthState> {
  Future<AuthState> _initGuestSession() async {
    try {
      final storage = ref.read(secureStorageServiceProvider);
      final deviceId = await storage.getOrCreateDeviceId();
      final locale = ref.read(localeControllerProvider).languageCode;
      final result = await ref.read(authApiProvider).guestAuth(
        deviceId: deviceId,
        locale: locale,
      );
      await storage.saveTokens(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );
      ref.read(apiClientProvider).setAccessToken(result.accessToken);
      return AuthState(status: AuthStatus.authenticated, user: result.user);
    } catch (_) {
      return AuthState.guest;
    }
  }

  @override
  Future<AuthState> build() async {
    final apiClient = ref.watch(apiClientProvider);
    // Wired once per ApiClient instance: if a background token refresh ever
    // definitively fails, re-init guest session immediately.
    apiClient.onSessionExpired = () async {
      final guestState = await _initGuestSession();
      state = AsyncData(guestState);
    };

    final storage = ref.watch(secureStorageServiceProvider);
    final accessToken = await storage.readAccessToken();
    if (accessToken == null) {
      return _initGuestSession();
    }

    apiClient.setAccessToken(accessToken);
    try {
      final user = await ref.read(authApiProvider).me();
      return AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await storage.clear();
      apiClient.setAccessToken(null);
      return _initGuestSession();
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

  Future<void> registerRequestCode({
    required String email,
    String? displayName,
    required String locale,
  }) => ref
      .read(authApiProvider)
      .registerRequestCode(
        email: email,
        displayName: displayName,
        locale: locale,
      );

  Future<void> registerComplete({
    required String email,
    required String code,
    required String password,
  }) async {
    final result = await ref
        .read(authApiProvider)
        .registerComplete(email: email, code: code, password: password);
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

  Future<void> requestPasswordReset({required String email}) =>
      ref.read(authApiProvider).requestPasswordReset(email: email);

  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    final result = await ref
        .read(authApiProvider)
        .resetPassword(email: email, code: code, newPassword: newPassword);
    await _applyAuthResult(result);
  }

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
    final guestState = await _initGuestSession();
    state = AsyncData(guestState);
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
