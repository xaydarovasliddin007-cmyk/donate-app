// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appName => 'Donate App';

  @override
  String get homeTitle => 'Главная';

  @override
  String get homeWelcomeMessage =>
      'Выберите игру и пополните счёт за пару секунд';

  @override
  String get commonRetry => 'Повторить';

  @override
  String get commonCancel => 'Отмена';

  @override
  String get commonSave => 'Сохранить';

  @override
  String get loadingMessage => 'Загрузка…';

  @override
  String get errorGenericTitle => 'Что-то пошло не так';

  @override
  String get errorGenericMessage => 'Пожалуйста, попробуйте ещё раз.';

  @override
  String get errorNoConnectionTitle => 'Нет подключения к интернету';

  @override
  String get errorNoConnectionMessage =>
      'Проверьте соединение с сетью и повторите попытку.';

  @override
  String get emptyGenericTitle => 'Здесь пока ничего нет';

  @override
  String get settingsTheme => 'Тема';

  @override
  String get settingsThemeLight => 'Светлая';

  @override
  String get settingsThemeDark => 'Тёмная';

  @override
  String get settingsThemeSystem => 'Как в системе';

  @override
  String get settingsLanguage => 'Язык';

  @override
  String get languageUzbek => 'O\'zbekcha';

  @override
  String get languageRussian => 'Русский';
}
