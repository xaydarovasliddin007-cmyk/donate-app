import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ru'),
    Locale('uz'),
  ];

  /// The application name, shown on the splash and in the OS task switcher.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE'**
  String get appName;

  /// No description provided for @homeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifa'**
  String get homeTitle;

  /// No description provided for @homeWelcomeMessage.
  ///
  /// In uz, this message translates to:
  /// **'O\'yiningizni tanlang va bir necha soniyada to\'ldiring'**
  String get homeWelcomeMessage;

  /// No description provided for @commonRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get commonRetry;

  /// No description provided for @commonCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get commonCancel;

  /// No description provided for @commonSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get commonSave;

  /// No description provided for @commonContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get commonContinue;

  /// No description provided for @commonClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get commonClose;

  /// No description provided for @commonCopy.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalash'**
  String get commonCopy;

  /// No description provided for @commonCopied.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalandi'**
  String get commonCopied;

  /// No description provided for @topupCardNumberCopied.
  ///
  /// In uz, this message translates to:
  /// **'Karta raqami nusxalandi'**
  String get topupCardNumberCopied;

  /// No description provided for @topupAmountCopied.
  ///
  /// In uz, this message translates to:
  /// **'Summa nusxalandi'**
  String get topupAmountCopied;

  /// No description provided for @commonConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get commonConfirm;

  /// No description provided for @commonComingSoon.
  ///
  /// In uz, this message translates to:
  /// **'Tez kunda'**
  String get commonComingSoon;

  /// No description provided for @commonSeeAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get commonSeeAll;

  /// No description provided for @loadingMessage.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda…'**
  String get loadingMessage;

  /// No description provided for @errorGenericTitle.
  ///
  /// In uz, this message translates to:
  /// **'Nimadir xato ketdi'**
  String get errorGenericTitle;

  /// No description provided for @errorGenericMessage.
  ///
  /// In uz, this message translates to:
  /// **'Iltimos, qayta urinib ko\'ring.'**
  String get errorGenericMessage;

  /// No description provided for @errorNoConnectionTitle.
  ///
  /// In uz, this message translates to:
  /// **'Internet aloqasi yo\'q'**
  String get errorNoConnectionTitle;

  /// No description provided for @errorNoConnectionMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tarmoqqa ulanishni tekshirib, qayta urining.'**
  String get errorNoConnectionMessage;

  /// No description provided for @errorUnauthorized.
  ///
  /// In uz, this message translates to:
  /// **'Email/telefon yoki parol noto\'g\'ri'**
  String get errorUnauthorized;

  /// No description provided for @errorConflict.
  ///
  /// In uz, this message translates to:
  /// **'Bu email yoki telefon raqami allaqachon ro\'yxatdan o\'tgan'**
  String get errorConflict;

  /// No description provided for @errorForbidden.
  ///
  /// In uz, this message translates to:
  /// **'Bu amalni bajarish uchun ruxsatingiz yo\'q'**
  String get errorForbidden;

  /// No description provided for @errorNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Topilmadi'**
  String get errorNotFound;

  /// No description provided for @errorServiceUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat vaqtincha ishlamayapti, birozdan so\'ng urinib ko\'ring'**
  String get errorServiceUnavailable;

  /// No description provided for @emptyGenericTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bu yerda hali hech narsa yo\'q'**
  String get emptyGenericTitle;

  /// No description provided for @settingsTheme.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get settingsTheme;

  /// No description provided for @settingsThemeLight.
  ///
  /// In uz, this message translates to:
  /// **'Yorug\''**
  String get settingsThemeLight;

  /// No description provided for @settingsThemeDark.
  ///
  /// In uz, this message translates to:
  /// **'Qorong\'i'**
  String get settingsThemeDark;

  /// No description provided for @settingsThemeSystem.
  ///
  /// In uz, this message translates to:
  /// **'Tizim sozlamasi'**
  String get settingsThemeSystem;

  /// No description provided for @settingsLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get settingsLanguage;

  /// No description provided for @settingsReduceMotion.
  ///
  /// In uz, this message translates to:
  /// **'Animatsiyalarni kamaytirish'**
  String get settingsReduceMotion;

  /// No description provided for @settingsReduceMotionDescription.
  ///
  /// In uz, this message translates to:
  /// **'Ba\'zi effektlarni o\'chirib, ilovani yengilroq qiling'**
  String get settingsReduceMotionDescription;

  /// No description provided for @settingsNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get settingsNotifications;

  /// No description provided for @settingsNotificationsDescription.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma va to\'lov holati o\'zgarganda darhol xabar oling'**
  String get settingsNotificationsDescription;

  /// No description provided for @settingsNotificationsOpenSettings.
  ///
  /// In uz, this message translates to:
  /// **'Bu qurilmada bildirishnomalar bloklangan — yoqish uchun tizim sozlamalarini oching'**
  String get settingsNotificationsOpenSettings;

  /// No description provided for @profileStatOrders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar'**
  String get profileStatOrders;

  /// No description provided for @languageUzbek.
  ///
  /// In uz, this message translates to:
  /// **'O\'zbekcha'**
  String get languageUzbek;

  /// No description provided for @languageRussian.
  ///
  /// In uz, this message translates to:
  /// **'Русский'**
  String get languageRussian;

  /// No description provided for @navHome.
  ///
  /// In uz, this message translates to:
  /// **'Bosh sahifa'**
  String get navHome;

  /// No description provided for @navGames.
  ///
  /// In uz, this message translates to:
  /// **'O\'yinlar'**
  String get navGames;

  /// No description provided for @navOrders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar'**
  String get navOrders;

  /// No description provided for @navProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @allGamesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Barcha o\'yinlar'**
  String get allGamesTitle;

  /// No description provided for @homeGreeting.
  ///
  /// In uz, this message translates to:
  /// **'Salom'**
  String get homeGreeting;

  /// No description provided for @onboardingWelcomeTitle.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE-ga xush kelibsiz'**
  String get onboardingWelcomeTitle;

  /// No description provided for @onboardingWelcomeSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Sevimli o\'yiningizni tanlang, bir necha soniyada to\'ldiring'**
  String get onboardingWelcomeSubtitle;

  /// No description provided for @onboardingGetStarted.
  ///
  /// In uz, this message translates to:
  /// **'Boshlash'**
  String get onboardingGetStarted;

  /// No description provided for @authLoginTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get authLoginTitle;

  /// No description provided for @authRegisterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get authRegisterTitle;

  /// No description provided for @authIdentifierLabel.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get authIdentifierLabel;

  /// No description provided for @authIdentifierHint.
  ///
  /// In uz, this message translates to:
  /// **'email@example.com'**
  String get authIdentifierHint;

  /// No description provided for @authPasswordLabel.
  ///
  /// In uz, this message translates to:
  /// **'Parol'**
  String get authPasswordLabel;

  /// No description provided for @authConfirmPasswordLabel.
  ///
  /// In uz, this message translates to:
  /// **'Parolni tasdiqlang'**
  String get authConfirmPasswordLabel;

  /// No description provided for @authPasswordMismatch.
  ///
  /// In uz, this message translates to:
  /// **'Parollar mos kelmadi'**
  String get authPasswordMismatch;

  /// No description provided for @authDisplayNameLabel.
  ///
  /// In uz, this message translates to:
  /// **'Ismingiz (ixtiyoriy)'**
  String get authDisplayNameLabel;

  /// No description provided for @authLoginButton.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get authLoginButton;

  /// No description provided for @authRegisterButton.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get authRegisterButton;

  /// No description provided for @authRegisterCompleteButton.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni yaratish'**
  String get authRegisterCompleteButton;

  /// No description provided for @authRegisterCompleteSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Kodni tasdiqlab, parolingizni tanlang'**
  String get authRegisterCompleteSubtitle;

  /// No description provided for @authNoAccountPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz yo\'qmi?'**
  String get authNoAccountPrompt;

  /// No description provided for @authSwitchToRegister.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get authSwitchToRegister;

  /// No description provided for @authHaveAccountPrompt.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz bormi?'**
  String get authHaveAccountPrompt;

  /// No description provided for @authSwitchToLogin.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get authSwitchToLogin;

  /// No description provided for @authIdentifierRequired.
  ///
  /// In uz, this message translates to:
  /// **'Email manzilingizni kiriting'**
  String get authIdentifierRequired;

  /// No description provided for @authIdentifierInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Email manzili noto\'g\'ri'**
  String get authIdentifierInvalid;

  /// No description provided for @authPasswordTooShort.
  ///
  /// In uz, this message translates to:
  /// **'Parol kamida 8 belgidan iborat bo\'lishi kerak'**
  String get authPasswordTooShort;

  /// No description provided for @authLoginRequiredTitle.
  ///
  /// In uz, this message translates to:
  /// **'Avval tizimga kiring'**
  String get authLoginRequiredTitle;

  /// No description provided for @authLoginRequiredMessage.
  ///
  /// In uz, this message translates to:
  /// **'Xarid qilish uchun hisobingizga kiring yoki ro\'yxatdan o\'ting'**
  String get authLoginRequiredMessage;

  /// No description provided for @authLogoutConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Chiqishni tasdiqlaysizmi?'**
  String get authLogoutConfirmTitle;

  /// No description provided for @authLogoutConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Qaytadan kirish uchun email va parolingiz kerak bo\'ladi'**
  String get authLogoutConfirmMessage;

  /// No description provided for @authLogoutButton.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get authLogoutButton;

  /// No description provided for @authContinueWithGoogle.
  ///
  /// In uz, this message translates to:
  /// **'Google orqali davom etish'**
  String get authContinueWithGoogle;

  /// No description provided for @authOrDivider.
  ///
  /// In uz, this message translates to:
  /// **'yoki'**
  String get authOrDivider;

  /// No description provided for @authGoogleUnavailableMessage.
  ///
  /// In uz, this message translates to:
  /// **'Google orqali kirish hozircha sozlanmagan'**
  String get authGoogleUnavailableMessage;

  /// No description provided for @authGoogleSignInFailed.
  ///
  /// In uz, this message translates to:
  /// **'Google orqali kirib bo\'lmadi. Qayta urinib ko\'ring.'**
  String get authGoogleSignInFailed;

  /// No description provided for @authVerifyEmailTitle.
  ///
  /// In uz, this message translates to:
  /// **'Emailni tasdiqlang'**
  String get authVerifyEmailTitle;

  /// No description provided for @authVerifyEmailMessage.
  ///
  /// In uz, this message translates to:
  /// **'{email} manziliga 6 xonali kod yubordik. Kodni quyida kiriting.'**
  String authVerifyEmailMessage(String email);

  /// No description provided for @authVerifyEmailCodeInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Kod 6 xonadan iborat bo\'lishi kerak'**
  String get authVerifyEmailCodeInvalid;

  /// No description provided for @authVerifyEmailResendButton.
  ///
  /// In uz, this message translates to:
  /// **'Kodni qayta yuborish'**
  String get authVerifyEmailResendButton;

  /// No description provided for @authVerifyEmailResendSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Kod qayta yuborildi'**
  String get authVerifyEmailResendSuccess;

  /// No description provided for @authVerifyEmailFailed.
  ///
  /// In uz, this message translates to:
  /// **'Kod noto\'g\'ri yoki eskirgan'**
  String get authVerifyEmailFailed;

  /// No description provided for @authForgotPasswordLink.
  ///
  /// In uz, this message translates to:
  /// **'Parolni unutdingizmi?'**
  String get authForgotPasswordLink;

  /// No description provided for @authForgotPasswordTitle.
  ///
  /// In uz, this message translates to:
  /// **'Parolni tiklash'**
  String get authForgotPasswordTitle;

  /// No description provided for @authForgotPasswordSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tgan email manzilingizni kiriting — sizga tiklash kodini yuboramiz.'**
  String get authForgotPasswordSubtitle;

  /// No description provided for @authForgotPasswordButton.
  ///
  /// In uz, this message translates to:
  /// **'Kod yuborish'**
  String get authForgotPasswordButton;

  /// No description provided for @authForgotPasswordSentMessage.
  ///
  /// In uz, this message translates to:
  /// **'Agar {email} bilan hisob mavjud bo\'lsa, unga tiklash kodi yuborildi.'**
  String authForgotPasswordSentMessage(String email);

  /// No description provided for @authResetPasswordSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Kodni tasdiqlab, yangi parolingizni tanlang'**
  String get authResetPasswordSubtitle;

  /// No description provided for @authResetPasswordButton.
  ///
  /// In uz, this message translates to:
  /// **'Parolni yangilash'**
  String get authResetPasswordButton;

  /// No description provided for @homeSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'O\'yin qidirish'**
  String get homeSearchHint;

  /// No description provided for @notificationsComingSoon.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar tez kunda'**
  String get notificationsComingSoon;

  /// No description provided for @homePopularGames.
  ///
  /// In uz, this message translates to:
  /// **'Mashhur o\'yinlar'**
  String get homePopularGames;

  /// No description provided for @homePopularTopups.
  ///
  /// In uz, this message translates to:
  /// **'Ommabop to\'ldirishlar'**
  String get homePopularTopups;

  /// No description provided for @homePromotions.
  ///
  /// In uz, this message translates to:
  /// **'Aksiyalar'**
  String get homePromotions;

  /// No description provided for @homeRecentOrders.
  ///
  /// In uz, this message translates to:
  /// **'So\'nggi buyurtmalar'**
  String get homeRecentOrders;

  /// No description provided for @homeMyGames.
  ///
  /// In uz, this message translates to:
  /// **'Mening o\'yinlarim'**
  String get homeMyGames;

  /// No description provided for @homeQuickBuyButton.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor xarid'**
  String get homeQuickBuyButton;

  /// No description provided for @homeHeroTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'yin balansingizni bir zumda to\'ldiring'**
  String get homeHeroTitle;

  /// No description provided for @homeHeroSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Mashhur o\'yinlar, xavfsiz to\'lov va buyurtma holatini kuzatish bitta ilovada.'**
  String get homeHeroSubtitle;

  /// No description provided for @homeHeroPrimaryCta.
  ///
  /// In uz, this message translates to:
  /// **'O\'yin tanlash'**
  String get homeHeroPrimaryCta;

  /// No description provided for @homeHeroSecondaryCta.
  ///
  /// In uz, this message translates to:
  /// **'Hisob yaratish'**
  String get homeHeroSecondaryCta;

  /// No description provided for @homeQuickCategoriesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor yo\'nalishlar'**
  String get homeQuickCategoriesTitle;

  /// No description provided for @allGamesClearSearch.
  ///
  /// In uz, this message translates to:
  /// **'Qidiruvni tozalash'**
  String get allGamesClearSearch;

  /// No description provided for @allGamesAllCategories.
  ///
  /// In uz, this message translates to:
  /// **'Barcha turlar'**
  String get allGamesAllCategories;

  /// No description provided for @allGamesResultsCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta o\'yin'**
  String allGamesResultsCount(int count);

  /// No description provided for @gameComingSoonBadge.
  ///
  /// In uz, this message translates to:
  /// **'Tez kunda'**
  String get gameComingSoonBadge;

  /// No description provided for @gameDetailsTopupTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish'**
  String get gameDetailsTopupTitle;

  /// No description provided for @gameDetailsProductsSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Paketni tanlang, keyingi bosqichda Player ID kiritasiz'**
  String get gameDetailsProductsSubtitle;

  /// No description provided for @gameProductsEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha mahsulotlar mavjud emas'**
  String get gameProductsEmptyTitle;

  /// No description provided for @gameNotAvailableMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bu o\'yin hali ulanmagan. Tez orada qo\'shamiz!'**
  String get gameNotAvailableMessage;

  /// No description provided for @gameServerPickerLabel.
  ///
  /// In uz, this message translates to:
  /// **'Serverni tanlang'**
  String get gameServerPickerLabel;

  /// No description provided for @playerInfoTitle.
  ///
  /// In uz, this message translates to:
  /// **'O\'yinchi ma\'lumotlari'**
  String get playerInfoTitle;

  /// No description provided for @playerInfoPlayerIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Player ID'**
  String get playerInfoPlayerIdLabel;

  /// No description provided for @playerInfoPlayerIdHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 123456789'**
  String get playerInfoPlayerIdHint;

  /// No description provided for @playerInfoPlayerTagLabel.
  ///
  /// In uz, this message translates to:
  /// **'Player Tag'**
  String get playerInfoPlayerTagLabel;

  /// No description provided for @playerInfoPlayerTagHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: #2PP0LQU8'**
  String get playerInfoPlayerTagHint;

  /// No description provided for @playerInfoUsernameLabel.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchi nomi'**
  String get playerInfoUsernameLabel;

  /// No description provided for @playerInfoUsernameHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: SizningNomingiz'**
  String get playerInfoUsernameHint;

  /// No description provided for @playerInfoServerIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Server ID (Zone)'**
  String get playerInfoServerIdLabel;

  /// No description provided for @playerInfoServerIdHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 2001'**
  String get playerInfoServerIdHint;

  /// No description provided for @playerInfoServerIdValidationError.
  ///
  /// In uz, this message translates to:
  /// **'Iltimos, Server ID ni kiriting'**
  String get playerInfoServerIdValidationError;

  /// No description provided for @playerInfoContinueButton.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get playerInfoContinueButton;

  /// No description provided for @playerInfoValidationError.
  ///
  /// In uz, this message translates to:
  /// **'Iltimos, Player ID ni kiriting'**
  String get playerInfoValidationError;

  /// No description provided for @playerInfoExampleLabel.
  ///
  /// In uz, this message translates to:
  /// **'Qayerdan topaman?'**
  String get playerInfoExampleLabel;

  /// No description provided for @purchaseRegionLabel.
  ///
  /// In uz, this message translates to:
  /// **'Hudud'**
  String get purchaseRegionLabel;

  /// No description provided for @checkoutTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani tasdiqlash'**
  String get checkoutTitle;

  /// No description provided for @checkoutGameLabel.
  ///
  /// In uz, this message translates to:
  /// **'O\'yin'**
  String get checkoutGameLabel;

  /// No description provided for @checkoutProductLabel.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot'**
  String get checkoutProductLabel;

  /// No description provided for @checkoutPlayerIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Player ID'**
  String get checkoutPlayerIdLabel;

  /// No description provided for @checkoutServerIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Server ID'**
  String get checkoutServerIdLabel;

  /// No description provided for @checkoutPriceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Narx'**
  String get checkoutPriceLabel;

  /// No description provided for @checkoutPaymentMethodLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov usuli'**
  String get checkoutPaymentMethodLabel;

  /// No description provided for @checkoutTotalLabel.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get checkoutTotalLabel;

  /// No description provided for @checkoutBuyNowButton.
  ///
  /// In uz, this message translates to:
  /// **'Hozir sotib olish'**
  String get checkoutBuyNowButton;

  /// No description provided for @checkoutMockPaymentLabel.
  ///
  /// In uz, this message translates to:
  /// **'Test to\'lov tizimi (dev)'**
  String get checkoutMockPaymentLabel;

  /// No description provided for @checkoutCreatingOrder.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma yaratilmoqda…'**
  String get checkoutCreatingOrder;

  /// No description provided for @checkoutPayWithWalletLabel.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE hamyoni'**
  String get checkoutPayWithWalletLabel;

  /// No description provided for @checkoutPayWithWalletBalance.
  ///
  /// In uz, this message translates to:
  /// **'Balans: {amount}'**
  String checkoutPayWithWalletBalance(String amount);

  /// No description provided for @checkoutPayWithPaymeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Payme'**
  String get checkoutPayWithPaymeLabel;

  /// No description provided for @checkoutPayWithPaymeSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Karta yoki QR orqali'**
  String get checkoutPayWithPaymeSubtitle;

  /// No description provided for @checkoutPayWithClickLabel.
  ///
  /// In uz, this message translates to:
  /// **'Click'**
  String get checkoutPayWithClickLabel;

  /// No description provided for @checkoutPayWithClickSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Karta yoki QR orqali'**
  String get checkoutPayWithClickSubtitle;

  /// No description provided for @checkoutInsufficientBalanceMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hamyoningizda mablag\' yetarli emas'**
  String get checkoutInsufficientBalanceMessage;

  /// No description provided for @checkoutTopUpNowButton.
  ///
  /// In uz, this message translates to:
  /// **'Hamyonni to\'ldirish'**
  String get checkoutTopUpNowButton;

  /// No description provided for @purchaseScreenTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sotib olish'**
  String get purchaseScreenTitle;

  /// No description provided for @purchaseStepData.
  ///
  /// In uz, this message translates to:
  /// **'Ma\'lumotlar'**
  String get purchaseStepData;

  /// No description provided for @purchaseStepPayment.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov'**
  String get purchaseStepPayment;

  /// No description provided for @purchaseStepConfirmation.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get purchaseStepConfirmation;

  /// No description provided for @purchaseValidatingMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda…'**
  String get purchaseValidatingMessage;

  /// No description provided for @purchaseFoundMessage.
  ///
  /// In uz, this message translates to:
  /// **'Topildi: {name}'**
  String purchaseFoundMessage(String name);

  /// No description provided for @purchaseAmountToPayLabel.
  ///
  /// In uz, this message translates to:
  /// **'To\'lanadigan summa'**
  String get purchaseAmountToPayLabel;

  /// No description provided for @purchasePayButton.
  ///
  /// In uz, this message translates to:
  /// **'To\'lash'**
  String get purchasePayButton;

  /// No description provided for @paymentDevSimulateTitle.
  ///
  /// In uz, this message translates to:
  /// **'Test to\'lovi (faqat dasturchilar uchun)'**
  String get paymentDevSimulateTitle;

  /// No description provided for @paymentDevSimulateMessage.
  ///
  /// In uz, this message translates to:
  /// **'Haqiqiy to\'lov provayderi hali ulanmagan. To\'lov natijasini qo\'lda tanlang:'**
  String get paymentDevSimulateMessage;

  /// No description provided for @paymentDevSimulateSuccessButton.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatli deb belgilash'**
  String get paymentDevSimulateSuccessButton;

  /// No description provided for @paymentDevSimulateFailButton.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatsiz deb belgilash'**
  String get paymentDevSimulateFailButton;

  /// No description provided for @paymentWaitingTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'lov kutilmoqda'**
  String get paymentWaitingTitle;

  /// No description provided for @paymentWaitingMessage.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovingiz tasdiqlanishini kutmoqdamiz'**
  String get paymentWaitingMessage;

  /// No description provided for @orderStatusTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma holati'**
  String get orderStatusTitle;

  /// No description provided for @orderNumberLabel.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma raqami'**
  String get orderNumberLabel;

  /// No description provided for @orderStatusLabel.
  ///
  /// In uz, this message translates to:
  /// **'Holat'**
  String get orderStatusLabel;

  /// No description provided for @orderCreatedAtLabel.
  ///
  /// In uz, this message translates to:
  /// **'Yaratilgan vaqt'**
  String get orderCreatedAtLabel;

  /// No description provided for @orderAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Summa'**
  String get orderAmountLabel;

  /// No description provided for @orderPlayerIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'Player ID'**
  String get orderPlayerIdLabel;

  /// No description provided for @orderFailureReasonLabel.
  ///
  /// In uz, this message translates to:
  /// **'Sabab'**
  String get orderFailureReasonLabel;

  /// No description provided for @orderStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get orderStatusPending;

  /// No description provided for @orderStatusPaid.
  ///
  /// In uz, this message translates to:
  /// **'To\'landi'**
  String get orderStatusPaid;

  /// No description provided for @orderStatusProcessing.
  ///
  /// In uz, this message translates to:
  /// **'Bajarilmoqda'**
  String get orderStatusProcessing;

  /// No description provided for @orderStatusCompleted.
  ///
  /// In uz, this message translates to:
  /// **'Bajarildi'**
  String get orderStatusCompleted;

  /// No description provided for @orderStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik'**
  String get orderStatusFailed;

  /// No description provided for @orderStatusCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilindi'**
  String get orderStatusCancelled;

  /// No description provided for @orderStatusRefunded.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarildi'**
  String get orderStatusRefunded;

  /// No description provided for @orderRefreshButton.
  ///
  /// In uz, this message translates to:
  /// **'Yangilash'**
  String get orderRefreshButton;

  /// No description provided for @orderContactSupportButton.
  ///
  /// In uz, this message translates to:
  /// **'Yordamga murojaat qilish'**
  String get orderContactSupportButton;

  /// No description provided for @supportRequestSubject.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE yordam so\'rovi — buyurtma {orderNumber}'**
  String supportRequestSubject(String orderNumber);

  /// No description provided for @supportGeneralSubject.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE yordam so\'rovi'**
  String get supportGeneralSubject;

  /// No description provided for @supportGeneralBody.
  ///
  /// In uz, this message translates to:
  /// **'Salom! Yordam kerak edi.'**
  String get supportGeneralBody;

  /// No description provided for @orderHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi'**
  String get orderHistoryTitle;

  /// No description provided for @orderHistoryStatSpent.
  ///
  /// In uz, this message translates to:
  /// **'Sarflandi'**
  String get orderHistoryStatSpent;

  /// No description provided for @orderHistoryEmptyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hali buyurtmalar yo\'q'**
  String get orderHistoryEmptyTitle;

  /// No description provided for @orderHistoryEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi xaridingizni amalga oshiring'**
  String get orderHistoryEmptyMessage;

  /// No description provided for @orderHistoryEmptyFilteredTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bu holatda buyurtma yo\'q'**
  String get orderHistoryEmptyFilteredTitle;

  /// No description provided for @orderFilterAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get orderFilterAll;

  /// No description provided for @orderFilterPending.
  ///
  /// In uz, this message translates to:
  /// **'Jarayonda'**
  String get orderFilterPending;

  /// No description provided for @orderFilterCompleted.
  ///
  /// In uz, this message translates to:
  /// **'Bajarildi'**
  String get orderFilterCompleted;

  /// No description provided for @orderFilterFailed.
  ///
  /// In uz, this message translates to:
  /// **'Muvaffaqiyatsiz'**
  String get orderFilterFailed;

  /// No description provided for @profileTitle.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get profileTitle;

  /// No description provided for @profileGuestTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mehmon sifatida ko\'rmoqdasiz'**
  String get profileGuestTitle;

  /// No description provided for @profileGuestMessage.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixini ko\'rish va xarid qilish uchun tizimga kiring'**
  String get profileGuestMessage;

  /// No description provided for @profileLoginButton.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get profileLoginButton;

  /// No description provided for @profileRegisterButton.
  ///
  /// In uz, this message translates to:
  /// **'Ro\'yxatdan o\'tish'**
  String get profileRegisterButton;

  /// No description provided for @profileOrderHistory.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar tarixi'**
  String get profileOrderHistory;

  /// No description provided for @profileLogoutButton.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get profileLogoutButton;

  /// No description provided for @walletTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon'**
  String get walletTitle;

  /// No description provided for @walletBalanceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Balans'**
  String get walletBalanceLabel;

  /// No description provided for @walletTopUpButton.
  ///
  /// In uz, this message translates to:
  /// **'Hamyonni to\'ldirish'**
  String get walletTopUpButton;

  /// No description provided for @walletTopUpShortButton.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish'**
  String get walletTopUpShortButton;

  /// No description provided for @walletSupportButton.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get walletSupportButton;

  /// No description provided for @walletHistoryButton.
  ///
  /// In uz, this message translates to:
  /// **'Tarix'**
  String get walletHistoryButton;

  /// No description provided for @walletTransactionHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon tarixi'**
  String get walletTransactionHistoryTitle;

  /// No description provided for @walletTransactionHistoryEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali tranzaksiyalar yo\'q'**
  String get walletTransactionHistoryEmpty;

  /// No description provided for @walletTypeTopup.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish'**
  String get walletTypeTopup;

  /// No description provided for @walletTypePurchase.
  ///
  /// In uz, this message translates to:
  /// **'Xarid'**
  String get walletTypePurchase;

  /// No description provided for @walletTypeRefund.
  ///
  /// In uz, this message translates to:
  /// **'Qaytarish'**
  String get walletTypeRefund;

  /// No description provided for @walletTypeAdjustment.
  ///
  /// In uz, this message translates to:
  /// **'Tuzatish'**
  String get walletTypeAdjustment;

  /// No description provided for @walletTypeBonus.
  ///
  /// In uz, this message translates to:
  /// **'Bonus'**
  String get walletTypeBonus;

  /// No description provided for @promoCodeButton.
  ///
  /// In uz, this message translates to:
  /// **'Promokod'**
  String get promoCodeButton;

  /// No description provided for @promoCodeSheetTitle.
  ///
  /// In uz, this message translates to:
  /// **'Promokodni faollashtiring'**
  String get promoCodeSheetTitle;

  /// No description provided for @promoCodeInputLabel.
  ///
  /// In uz, this message translates to:
  /// **'Promokod'**
  String get promoCodeInputLabel;

  /// No description provided for @promoCodeInputHint.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get promoCodeInputHint;

  /// No description provided for @promoCodeActivateButton.
  ///
  /// In uz, this message translates to:
  /// **'Faollashtirish'**
  String get promoCodeActivateButton;

  /// No description provided for @promoCodeSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'{amount} hisobingizga qo\'shildi!'**
  String promoCodeSuccessMessage(String amount);

  /// No description provided for @promoCodeInvalid.
  ///
  /// In uz, this message translates to:
  /// **'Bunday promokod topilmadi yoki muddati o\'tgan'**
  String get promoCodeInvalid;

  /// No description provided for @promoCodeAlreadyRedeemed.
  ///
  /// In uz, this message translates to:
  /// **'Bu promokodni allaqachon ishlatgansiz'**
  String get promoCodeAlreadyRedeemed;

  /// No description provided for @checkoutPayWithWallet.
  ///
  /// In uz, this message translates to:
  /// **'Hamyondan to\'lash'**
  String get checkoutPayWithWallet;

  /// No description provided for @checkoutWalletBalance.
  ///
  /// In uz, this message translates to:
  /// **'Balans: {balance}'**
  String checkoutWalletBalance(Object balance);

  /// No description provided for @checkoutInsufficientBalance.
  ///
  /// In uz, this message translates to:
  /// **'Hamyonda mablag\' yetarli emas'**
  String get checkoutInsufficientBalance;

  /// No description provided for @checkoutTopUpNow.
  ///
  /// In uz, this message translates to:
  /// **'Hozir to\'ldirish'**
  String get checkoutTopUpNow;

  /// No description provided for @topupTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hamyonni to\'ldirish'**
  String get topupTitle;

  /// No description provided for @topupAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Summa'**
  String get topupAmountLabel;

  /// No description provided for @topupAmountHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: 50000'**
  String get topupAmountHint;

  /// No description provided for @topupSelectMethodTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirish usulini tanlang'**
  String get topupSelectMethodTitle;

  /// No description provided for @topupBankLabel.
  ///
  /// In uz, this message translates to:
  /// **'Bank'**
  String get topupBankLabel;

  /// No description provided for @topupSubmitButton.
  ///
  /// In uz, this message translates to:
  /// **'Karta olish'**
  String get topupSubmitButton;

  /// No description provided for @topupInstructionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Balans qanday to\'ldiriladi?'**
  String get topupInstructionsTitle;

  /// No description provided for @topupStep1Title.
  ///
  /// In uz, this message translates to:
  /// **'Summani kiriting'**
  String get topupStep1Title;

  /// No description provided for @topupStep1Message.
  ///
  /// In uz, this message translates to:
  /// **'Necha pul o\'tkazmoqchi bo\'lsangiz, o\'sha summani kiriting'**
  String get topupStep1Message;

  /// No description provided for @topupStep2Title.
  ///
  /// In uz, this message translates to:
  /// **'Kartalar ko\'rsatiladi'**
  String get topupStep2Title;

  /// No description provided for @topupStep2Message.
  ///
  /// In uz, this message translates to:
  /// **'Ilova sizga bir nechta karta raqamini ko\'rsatadi — istalganiga o\'tkazishingiz mumkin'**
  String get topupStep2Message;

  /// No description provided for @topupStep3Title.
  ///
  /// In uz, this message translates to:
  /// **'Aynan shu summani o\'tkazing'**
  String get topupStep3Title;

  /// No description provided for @topupStep3Message.
  ///
  /// In uz, this message translates to:
  /// **'Ko\'rsatilgan kartaga rovno shu summani o\'tkazing — balansingiz avtomatik to\'ldiriladi'**
  String get topupStep3Message;

  /// No description provided for @topupUserReferenceLabel.
  ///
  /// In uz, this message translates to:
  /// **'Izoh (ixtiyoriy)'**
  String get topupUserReferenceLabel;

  /// No description provided for @topupUserReferenceHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: kartangizning oxirgi 4 raqami'**
  String get topupUserReferenceHint;

  /// No description provided for @topupSuccessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Balans to\'ldirildi'**
  String get topupSuccessTitle;

  /// No description provided for @topupSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovingiz aniqlandi va balansingizga qo\'shildi.'**
  String get topupSuccessMessage;

  /// No description provided for @topupHistoryTitle.
  ///
  /// In uz, this message translates to:
  /// **'To\'ldirishlar tarixi'**
  String get topupHistoryTitle;

  /// No description provided for @topupStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda'**
  String get topupStatusPending;

  /// No description provided for @topupStatusVerified.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlandi'**
  String get topupStatusVerified;

  /// No description provided for @topupStatusRejected.
  ///
  /// In uz, this message translates to:
  /// **'Rad etildi'**
  String get topupStatusRejected;

  /// No description provided for @topupStatusExpired.
  ///
  /// In uz, this message translates to:
  /// **'Muddati o\'tgan'**
  String get topupStatusExpired;

  /// No description provided for @topupValidationError.
  ///
  /// In uz, this message translates to:
  /// **'Summani kiriting'**
  String get topupValidationError;

  /// No description provided for @topupReservedCardTitle.
  ///
  /// In uz, this message translates to:
  /// **'Quyidagi kartalardan biriga o\'tkazing'**
  String get topupReservedCardTitle;

  /// No description provided for @topupNoCommissionNote.
  ///
  /// In uz, this message translates to:
  /// **'Barcha kartalar orqali komissiyasiz o\'tkazma'**
  String get topupNoCommissionNote;

  /// No description provided for @topupExactAmountLabel.
  ///
  /// In uz, this message translates to:
  /// **'Aynan shu summani o\'tkazing'**
  String get topupExactAmountLabel;

  /// No description provided for @topupExactAmountWarning.
  ///
  /// In uz, this message translates to:
  /// **'Faqat aynan ko\'rsatilgan summani o\'tkazing. Boshqacha summa yuborilsa, mablag\' hisobingizga tushmaydi!'**
  String get topupExactAmountWarning;

  /// No description provided for @topupTimeLeftLabel.
  ///
  /// In uz, this message translates to:
  /// **'Qolgan vaqt: {time}'**
  String topupTimeLeftLabel(String time);

  /// No description provided for @topupWaitingMessage.
  ///
  /// In uz, this message translates to:
  /// **'To\'lovingizni kutyapmiz. Pul tushishi bilan balansingiz avtomatik to\'ldiriladi.'**
  String get topupWaitingMessage;

  /// No description provided for @topupIvePaidButton.
  ///
  /// In uz, this message translates to:
  /// **'To\'ladim'**
  String get topupIvePaidButton;

  /// No description provided for @topupCheckingMessage.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda… odatda bir necha soniyada tasdiqlanadi.'**
  String get topupCheckingMessage;

  /// No description provided for @topupExpiredTitle.
  ///
  /// In uz, this message translates to:
  /// **'Vaqt tugadi'**
  String get topupExpiredTitle;

  /// No description provided for @topupExpiredMessage.
  ///
  /// In uz, this message translates to:
  /// **'Ushbu band qilingan vaqt tugadi. Qaytadan urinib ko\'ring.'**
  String get topupExpiredMessage;

  /// No description provided for @topupTryAgainButton.
  ///
  /// In uz, this message translates to:
  /// **'Qaytadan urinish'**
  String get topupTryAgainButton;

  /// No description provided for @topupCancelReservationButton.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get topupCancelReservationButton;

  /// No description provided for @profileUzdonateIdLabel.
  ///
  /// In uz, this message translates to:
  /// **'UZDONATE ID'**
  String get profileUzdonateIdLabel;

  /// No description provided for @profileCopyButton.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalash'**
  String get profileCopyButton;

  /// No description provided for @profileCopiedMessage.
  ///
  /// In uz, this message translates to:
  /// **'Nusxalandi'**
  String get profileCopiedMessage;

  /// No description provided for @profileSecurityCenter.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizlik'**
  String get profileSecurityCenter;

  /// No description provided for @profileWallet.
  ///
  /// In uz, this message translates to:
  /// **'Hamyon'**
  String get profileWallet;

  /// No description provided for @profileNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get profileNotifications;

  /// No description provided for @profileSupport.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get profileSupport;

  /// No description provided for @securityCenterTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizlik markazi'**
  String get securityCenterTitle;

  /// No description provided for @securityAccountSection.
  ///
  /// In uz, this message translates to:
  /// **'Hisob'**
  String get securityAccountSection;

  /// No description provided for @securityEmailLabel.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get securityEmailLabel;

  /// No description provided for @securityGoogleLinkedLabel.
  ///
  /// In uz, this message translates to:
  /// **'Google hisobi ulangan'**
  String get securityGoogleLinkedLabel;

  /// No description provided for @securityGoogleNotLinkedLabel.
  ///
  /// In uz, this message translates to:
  /// **'Google hisobi ulanmagan'**
  String get securityGoogleNotLinkedLabel;

  /// No description provided for @securitySessionsSection.
  ///
  /// In uz, this message translates to:
  /// **'Faol seanslar'**
  String get securitySessionsSection;

  /// No description provided for @securitySessionsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Faol seanslar topilmadi'**
  String get securitySessionsEmpty;

  /// No description provided for @securitySessionCurrentBadge.
  ///
  /// In uz, this message translates to:
  /// **'Joriy'**
  String get securitySessionCurrentBadge;

  /// No description provided for @securitySessionRevokeButton.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get securitySessionRevokeButton;

  /// No description provided for @securityDeviceAndroid.
  ///
  /// In uz, this message translates to:
  /// **'Android qurilma'**
  String get securityDeviceAndroid;

  /// No description provided for @securityDeviceIphone.
  ///
  /// In uz, this message translates to:
  /// **'iPhone'**
  String get securityDeviceIphone;

  /// No description provided for @securityDeviceWindows.
  ///
  /// In uz, this message translates to:
  /// **'Windows'**
  String get securityDeviceWindows;

  /// No description provided for @securityDeviceMac.
  ///
  /// In uz, this message translates to:
  /// **'Mac'**
  String get securityDeviceMac;

  /// No description provided for @securityDeviceUnknown.
  ///
  /// In uz, this message translates to:
  /// **'Noma\'lum qurilma'**
  String get securityDeviceUnknown;

  /// No description provided for @securityLogoutAllButton.
  ///
  /// In uz, this message translates to:
  /// **'Barcha qurilmalardan chiqish'**
  String get securityLogoutAllButton;

  /// No description provided for @securityLogoutAllConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Barcha qurilmalardan chiqasizmi?'**
  String get securityLogoutAllConfirmTitle;

  /// No description provided for @securityLogoutAllConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Barcha seanslar tugatiladi, qayta kirishingiz kerak bo\'ladi'**
  String get securityLogoutAllConfirmMessage;

  /// No description provided for @securityDeleteAccountSection.
  ///
  /// In uz, this message translates to:
  /// **'Xavfli hudud'**
  String get securityDeleteAccountSection;

  /// No description provided for @securityDeleteAccountButton.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni o\'chirish'**
  String get securityDeleteAccountButton;

  /// No description provided for @securityDeleteAccountConfirmTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni o\'chirasizmi?'**
  String get securityDeleteAccountConfirmTitle;

  /// No description provided for @securityDeleteAccountConfirmMessage.
  ///
  /// In uz, this message translates to:
  /// **'Bu amalni bekor qilib bo\'lmaydi. Hisobingiz o\'chiriladi va barcha seanslar tugatiladi.'**
  String get securityDeleteAccountConfirmMessage;

  /// No description provided for @securityDeleteAccountWalletNotEmptyMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni o\'chirishdan oldin hamyon balansini sarflang yoki yordam xizmatiga murojaat qiling — UZDONATE hamyonidan mablag\' yechib olish imkoni yo\'q.'**
  String get securityDeleteAccountWalletNotEmptyMessage;

  /// No description provided for @securityDeleteAccountSuccessMessage.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz o\'chirildi'**
  String get securityDeleteAccountSuccessMessage;

  /// No description provided for @notificationsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get notificationsTitle;

  /// No description provided for @notificationsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hali bildirishnomalar yo\'q'**
  String get notificationsEmpty;

  /// No description provided for @notificationsMarkAllRead.
  ///
  /// In uz, this message translates to:
  /// **'Barchasini o\'qilgan deb belgilash'**
  String get notificationsMarkAllRead;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
