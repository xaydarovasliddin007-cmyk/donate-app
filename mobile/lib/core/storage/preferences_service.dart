import 'package:shared_preferences/shared_preferences.dart';

/// Thin typed wrapper around [SharedPreferences] so the rest of the app
/// never touches raw string keys directly.
class PreferencesService {
  PreferencesService(this._prefs);

  final SharedPreferences _prefs;

  static const _themeModeKey = 'settings.theme_mode';
  static const _localeKey = 'settings.locale';
  static const _onboardingCompleteKey = 'settings.onboarding_complete';
  static const _reduceMotionKey = 'settings.reduce_motion';
  static const _lastSeenNotificationIdKey = 'notifications.last_seen_id';

  String? get themeMode => _prefs.getString(_themeModeKey);
  Future<void> setThemeMode(String value) =>
      _prefs.setString(_themeModeKey, value);

  String? get locale => _prefs.getString(_localeKey);
  Future<void> setLocale(String value) => _prefs.setString(_localeKey, value);

  bool get hasCompletedOnboarding =>
      _prefs.getBool(_onboardingCompleteKey) ?? false;
  Future<void> setOnboardingComplete() =>
      _prefs.setBool(_onboardingCompleteKey, true);

  bool get reduceMotion => _prefs.getBool(_reduceMotionKey) ?? false;
  Future<void> setReduceMotion(bool value) =>
      _prefs.setBool(_reduceMotionKey, value);

  String? get lastSeenNotificationId =>
      _prefs.getString(_lastSeenNotificationIdKey);
  Future<void> setLastSeenNotificationId(String value) =>
      _prefs.setString(_lastSeenNotificationIdKey, value);
}
