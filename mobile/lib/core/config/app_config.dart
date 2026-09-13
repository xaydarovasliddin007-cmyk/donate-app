/// Build-time configuration, injected via `--dart-define` so nothing
/// environment-specific is hardcoded or bundled as a plaintext asset.
///
/// Example: flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
abstract final class AppConfig {
  /// Defaults to the Android emulator's alias for the host machine's
  /// localhost, since that's the most common local dev setup.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://donate-app-5vhs.onrender.com/api/v1',
  );

  /// The OAuth 2.0 Web client ID from Google Cloud Console (used as
  /// `serverClientId` so the backend receives a token it can verify).
  ///
  /// Example: flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '223785346997-vphv1k7i131r72orkhj05dnvvhocd9br.apps.googleusercontent.com',
  );

  static bool get isGoogleSignInConfigured => googleServerClientId.isNotEmpty;

  /// Telegram support username (without the leading @).
  ///
  /// Example: flutter run --dart-define=SUPPORT_TELEGRAM_USERNAME=uzdonate_support
  static const String supportTelegramUsername = String.fromEnvironment(
    'SUPPORT_TELEGRAM_USERNAME',
    defaultValue: 'The_Anonimous_uzb',
  );

  /// Fallback support contact when Telegram isn't configured.
  static const String supportEmail = String.fromEnvironment(
    'SUPPORT_EMAIL',
    defaultValue: 'support@uzdonate.dev',
  );

  static bool get isSupportTelegramConfigured =>
      supportTelegramUsername.isNotEmpty;
}
