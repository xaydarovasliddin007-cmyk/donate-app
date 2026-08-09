// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get appName => 'Donate App';

  @override
  String get homeTitle => 'Bosh sahifa';

  @override
  String get homeWelcomeMessage =>
      'O\'yiningizni tanlang va bir necha soniyada to\'ldiring';

  @override
  String get commonRetry => 'Qayta urinish';

  @override
  String get commonCancel => 'Bekor qilish';

  @override
  String get commonSave => 'Saqlash';

  @override
  String get loadingMessage => 'Yuklanmoqda…';

  @override
  String get errorGenericTitle => 'Nimadir xato ketdi';

  @override
  String get errorGenericMessage => 'Iltimos, qayta urinib ko\'ring.';

  @override
  String get errorNoConnectionTitle => 'Internet aloqasi yo\'q';

  @override
  String get errorNoConnectionMessage =>
      'Tarmoqqa ulanishni tekshirib, qayta urining.';

  @override
  String get emptyGenericTitle => 'Bu yerda hali hech narsa yo\'q';

  @override
  String get settingsTheme => 'Mavzu';

  @override
  String get settingsThemeLight => 'Yorug\'';

  @override
  String get settingsThemeDark => 'Qorong\'i';

  @override
  String get settingsThemeSystem => 'Tizim sozlamasi';

  @override
  String get settingsLanguage => 'Til';

  @override
  String get languageUzbek => 'O\'zbekcha';

  @override
  String get languageRussian => 'Русский';
}
