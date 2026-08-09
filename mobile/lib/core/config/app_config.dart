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
}
