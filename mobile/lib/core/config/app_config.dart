/// Build-time configuration, injected via `--dart-define` so nothing
/// environment-specific is hardcoded or bundled as a plaintext asset.
///
/// Example: flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
abstract final class AppConfig {
  /// Defaults to the Android emulator's alias for the host machine's
  /// localhost, since that's the most common local dev setup.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  /// The OAuth 2.0 Web client ID from Google Cloud Console (used as
  /// `serverClientId` so the backend receives a token it can verify).
  /// Empty by default: Google sign-in is real, fully-wired code, but a GCP
  /// project's credentials can't be invented — see mobile/README.md for
  /// setup. When empty, the UI disables the button instead of crashing.
  ///
  /// Example: flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );

  static bool get isGoogleSignInConfigured => googleServerClientId.isNotEmpty;
}
