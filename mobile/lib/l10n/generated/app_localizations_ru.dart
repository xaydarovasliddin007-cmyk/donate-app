// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appName => 'UZDONATE';

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
  String get commonContinue => 'Продолжить';

  @override
  String get commonClose => 'Закрыть';

  @override
  String get commonConfirm => 'Подтвердить';

  @override
  String get commonComingSoon => 'Скоро';

  @override
  String get commonSeeAll => 'Все';

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
  String get errorUnauthorized => 'Неверный email/телефон или пароль';

  @override
  String get errorConflict =>
      'Этот email или номер телефона уже зарегистрирован';

  @override
  String get errorForbidden => 'У вас нет прав для этого действия';

  @override
  String get errorNotFound => 'Не найдено';

  @override
  String get errorServiceUnavailable =>
      'Сервис временно недоступен, попробуйте позже';

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
  String get settingsReduceMotion => 'Меньше анимаций';

  @override
  String get settingsReduceMotionDescription =>
      'Отключите часть эффектов, чтобы приложение работало легче';

  @override
  String get settingsNotifications => 'Уведомления';

  @override
  String get settingsNotificationsDescription =>
      'Узнавайте сразу, когда статус заказа или оплаты изменится';

  @override
  String get settingsNotificationsOpenSettings =>
      'Уведомления заблокированы на этом устройстве — откройте системные настройки, чтобы включить';

  @override
  String get profileStatOrders => 'Заказы';

  @override
  String get languageUzbek => 'O\'zbekcha';

  @override
  String get languageRussian => 'Русский';

  @override
  String get navHome => 'Главная';

  @override
  String get navGames => 'Игры';

  @override
  String get navOrders => 'Заказы';

  @override
  String get navProfile => 'Профиль';

  @override
  String get allGamesTitle => 'Все игры';

  @override
  String get homeGreeting => 'Привет';

  @override
  String get onboardingWelcomeTitle => 'Добро пожаловать в UZDONATE';

  @override
  String get onboardingWelcomeSubtitle =>
      'Выберите любимую игру и пополните счёт за секунды';

  @override
  String get onboardingGetStarted => 'Начать';

  @override
  String get authLoginTitle => 'Вход';

  @override
  String get authRegisterTitle => 'Регистрация';

  @override
  String get authIdentifierLabel => 'Email';

  @override
  String get authIdentifierHint => 'email@example.com';

  @override
  String get authPasswordLabel => 'Пароль';

  @override
  String get authConfirmPasswordLabel => 'Подтвердите пароль';

  @override
  String get authPasswordMismatch => 'Пароли не совпадают';

  @override
  String get authDisplayNameLabel => 'Имя (необязательно)';

  @override
  String get authLoginButton => 'Войти';

  @override
  String get authRegisterButton => 'Зарегистрироваться';

  @override
  String get authRegisterCompleteButton => 'Создать аккаунт';

  @override
  String get authRegisterCompleteSubtitle =>
      'Подтвердите код и придумайте пароль';

  @override
  String get authNoAccountPrompt => 'Нет аккаунта?';

  @override
  String get authSwitchToRegister => 'Зарегистрироваться';

  @override
  String get authHaveAccountPrompt => 'Уже есть аккаунт?';

  @override
  String get authSwitchToLogin => 'Войти';

  @override
  String get authIdentifierRequired => 'Введите email';

  @override
  String get authIdentifierInvalid => 'Неверный формат email';

  @override
  String get authPasswordTooShort =>
      'Пароль должен содержать не менее 8 символов';

  @override
  String get authLoginRequiredTitle => 'Сначала войдите в аккаунт';

  @override
  String get authLoginRequiredMessage =>
      'Чтобы оформить покупку, войдите в аккаунт или зарегистрируйтесь';

  @override
  String get authLogoutConfirmTitle => 'Подтвердите выход';

  @override
  String get authLogoutConfirmMessage =>
      'Для повторного входа понадобятся email и пароль';

  @override
  String get authLogoutButton => 'Выйти';

  @override
  String get authContinueWithGoogle => 'Продолжить через Google';

  @override
  String get authOrDivider => 'или';

  @override
  String get authGoogleUnavailableMessage =>
      'Вход через Google пока не настроен';

  @override
  String get authGoogleSignInFailed =>
      'Не удалось войти через Google. Попробуйте снова.';

  @override
  String get authVerifyEmailTitle => 'Подтвердите email';

  @override
  String authVerifyEmailMessage(String email) {
    return 'Мы отправили 6-значный код на $email. Введите его ниже.';
  }

  @override
  String get authVerifyEmailCodeInvalid => 'Код должен состоять из 6 цифр';

  @override
  String get authVerifyEmailResendButton => 'Отправить код повторно';

  @override
  String get authVerifyEmailResendSuccess => 'Код отправлен повторно';

  @override
  String get authVerifyEmailFailed => 'Код неверен или истёк';

  @override
  String get homeSearchHint => 'Поиск игры';

  @override
  String get notificationsComingSoon => 'Уведомления скоро';

  @override
  String get homePopularGames => 'Популярные игры';

  @override
  String get homePopularTopups => 'Популярные пополнения';

  @override
  String get homePromotions => 'Акции';

  @override
  String get homeRecentOrders => 'Последние заказы';

  @override
  String get homeMyGames => 'Мои игры';

  @override
  String get homeQuickBuyButton => 'Быстрая покупка';

  @override
  String get gameComingSoonBadge => 'Скоро';

  @override
  String get gameDetailsTopupTitle => 'Пополнение';

  @override
  String get gameProductsEmptyTitle => 'Пока нет доступных товаров';

  @override
  String get gameNotAvailableMessage =>
      'Эта игра пока не подключена. Скоро добавим!';

  @override
  String get gameServerPickerLabel => 'Выберите сервер';

  @override
  String get playerInfoTitle => 'Данные игрока';

  @override
  String get playerInfoPlayerIdLabel => 'Player ID';

  @override
  String get playerInfoPlayerIdHint => 'Например: 123456789';

  @override
  String get playerInfoPlayerTagLabel => 'Player Tag';

  @override
  String get playerInfoPlayerTagHint => 'Например: #2PP0LQU8';

  @override
  String get playerInfoUsernameLabel => 'Имя пользователя';

  @override
  String get playerInfoUsernameHint => 'Например: ВашеИмя';

  @override
  String get playerInfoServerIdLabel => 'Server ID';

  @override
  String get playerInfoServerIdHint => 'Например: 2001';

  @override
  String get playerInfoContinueButton => 'Продолжить';

  @override
  String get playerInfoValidationError => 'Пожалуйста, введите Player ID';

  @override
  String get playerInfoExampleLabel => 'Где найти?';

  @override
  String get checkoutTitle => 'Подтверждение заказа';

  @override
  String get checkoutGameLabel => 'Игра';

  @override
  String get checkoutProductLabel => 'Товар';

  @override
  String get checkoutPlayerIdLabel => 'Player ID';

  @override
  String get checkoutServerIdLabel => 'Server ID';

  @override
  String get checkoutPriceLabel => 'Цена';

  @override
  String get checkoutPaymentMethodLabel => 'Способ оплаты';

  @override
  String get checkoutTotalLabel => 'Итого';

  @override
  String get checkoutBuyNowButton => 'Купить сейчас';

  @override
  String get checkoutMockPaymentLabel => 'Тестовая платёжная система (dev)';

  @override
  String get checkoutCreatingOrder => 'Создание заказа…';

  @override
  String get checkoutPayWithWalletLabel => 'Кошелёк UZDONATE';

  @override
  String checkoutPayWithWalletBalance(String amount) {
    return 'Баланс: $amount';
  }

  @override
  String get checkoutInsufficientBalanceMessage =>
      'Недостаточно средств на кошельке';

  @override
  String get checkoutTopUpNowButton => 'Пополнить кошелёк';

  @override
  String get paymentDevSimulateTitle =>
      'Тестовый платёж (только для разработки)';

  @override
  String get paymentDevSimulateMessage =>
      'Реальный платёжный провайдер ещё не подключён. Выберите результат оплаты вручную:';

  @override
  String get paymentDevSimulateSuccessButton => 'Отметить как успешный';

  @override
  String get paymentDevSimulateFailButton => 'Отметить как неудачный';

  @override
  String get paymentWaitingTitle => 'Ожидание оплаты';

  @override
  String get paymentWaitingMessage => 'Ожидаем подтверждения вашего платежа';

  @override
  String get orderStatusTitle => 'Статус заказа';

  @override
  String get orderNumberLabel => 'Номер заказа';

  @override
  String get orderStatusLabel => 'Статус';

  @override
  String get orderCreatedAtLabel => 'Время создания';

  @override
  String get orderAmountLabel => 'Сумма';

  @override
  String get orderPlayerIdLabel => 'Player ID';

  @override
  String get orderFailureReasonLabel => 'Причина';

  @override
  String get orderStatusPending => 'Ожидание';

  @override
  String get orderStatusPaid => 'Оплачено';

  @override
  String get orderStatusProcessing => 'Выполняется';

  @override
  String get orderStatusCompleted => 'Выполнено';

  @override
  String get orderStatusFailed => 'Ошибка';

  @override
  String get orderStatusCancelled => 'Отменено';

  @override
  String get orderStatusRefunded => 'Возврат';

  @override
  String get orderRefreshButton => 'Обновить';

  @override
  String get orderContactSupportButton => 'Связаться с поддержкой';

  @override
  String supportRequestSubject(String orderNumber) {
    return 'Запрос в поддержку UZDONATE — заказ $orderNumber';
  }

  @override
  String get supportGeneralSubject => 'Запрос в поддержку UZDONATE';

  @override
  String get supportGeneralBody => 'Здравствуйте! Нужна помощь.';

  @override
  String get orderHistoryTitle => 'История заказов';

  @override
  String get orderHistoryEmptyTitle => 'Пока нет заказов';

  @override
  String get orderHistoryEmptyMessage => 'Оформите свою первую покупку';

  @override
  String get profileTitle => 'Профиль';

  @override
  String get profileGuestTitle => 'Вы смотрите как гость';

  @override
  String get profileGuestMessage =>
      'Войдите в аккаунт, чтобы видеть историю заказов и покупать';

  @override
  String get profileLoginButton => 'Войти';

  @override
  String get profileRegisterButton => 'Зарегистрироваться';

  @override
  String get profileOrderHistory => 'История заказов';

  @override
  String get profileLogoutButton => 'Выйти';

  @override
  String get walletTitle => 'Кошелёк';

  @override
  String get walletBalanceLabel => 'Баланс';

  @override
  String get walletTopUpButton => 'Пополнить кошелёк';

  @override
  String get walletTopUpShortButton => 'Пополнить';

  @override
  String get walletSupportButton => 'Поддержка';

  @override
  String get walletHistoryButton => 'История';

  @override
  String get walletTransactionHistoryTitle => 'История кошелька';

  @override
  String get walletTransactionHistoryEmpty => 'Пока нет транзакций';

  @override
  String get walletTypeTopup => 'Пополнение';

  @override
  String get walletTypePurchase => 'Покупка';

  @override
  String get walletTypeRefund => 'Возврат';

  @override
  String get walletTypeAdjustment => 'Корректировка';

  @override
  String get walletTypeBonus => 'Бонус';

  @override
  String get promoCodeButton => 'Промокод';

  @override
  String get promoCodeSheetTitle => 'Активировать промокод';

  @override
  String get promoCodeInputLabel => 'Промокод';

  @override
  String get promoCodeInputHint => 'Введите код';

  @override
  String get promoCodeActivateButton => 'Активировать';

  @override
  String promoCodeSuccessMessage(String amount) {
    return '$amount зачислено на ваш баланс!';
  }

  @override
  String get promoCodeInvalid => 'Такой промокод не найден или истёк';

  @override
  String get promoCodeAlreadyRedeemed => 'Вы уже использовали этот промокод';

  @override
  String get checkoutPayWithWallet => 'Оплатить с кошелька';

  @override
  String checkoutWalletBalance(Object balance) {
    return 'Баланс: $balance';
  }

  @override
  String get checkoutInsufficientBalance => 'Недостаточно средств на кошельке';

  @override
  String get checkoutTopUpNow => 'Пополнить сейчас';

  @override
  String get topupTitle => 'Пополнить кошелёк';

  @override
  String get topupAmountLabel => 'Сумма';

  @override
  String get topupAmountHint => 'Например: 50000';

  @override
  String get topupSelectMethodTitle => 'Выберите способ пополнения';

  @override
  String get topupBankLabel => 'Банк';

  @override
  String get topupSubmitButton => 'Подтвердить оплату';

  @override
  String get topupInstructionsTitle => 'Как пополняется баланс?';

  @override
  String get topupStep1Title => 'Переведите сумму';

  @override
  String get topupStep1Message =>
      'Переведите выбранную сумму на карту, указанную ниже';

  @override
  String get topupStep2Title => 'Подтвердите';

  @override
  String get topupStep2Message =>
      'Нажмите «Подтвердить оплату», чтобы отправить запрос';

  @override
  String get topupStep3Title => 'Дождитесь проверки';

  @override
  String get topupStep3Message =>
      'После проверки администратором баланс пополнится автоматически';

  @override
  String get topupUserReferenceLabel => 'Комментарий (необязательно)';

  @override
  String get topupUserReferenceHint =>
      'Например: последние 4 цифры вашей карты';

  @override
  String get topupSuccessTitle => 'Заявка отправлена';

  @override
  String get topupSuccessMessage =>
      'Ваш платёж проверяется. После подтверждения баланс пополнится автоматически.';

  @override
  String get topupHistoryTitle => 'История пополнений';

  @override
  String get topupStatusPending => 'Проверяется';

  @override
  String get topupStatusVerified => 'Подтверждено';

  @override
  String get topupStatusRejected => 'Отклонено';

  @override
  String get topupStatusExpired => 'Истёк срок';

  @override
  String get topupValidationError => 'Введите сумму';

  @override
  String get profileUzdonateIdLabel => 'UZDONATE ID';

  @override
  String get profileCopyButton => 'Копировать';

  @override
  String get profileCopiedMessage => 'Скопировано';

  @override
  String get profileSecurityCenter => 'Безопасность';

  @override
  String get profileWallet => 'Кошелёк';

  @override
  String get profileNotifications => 'Уведомления';

  @override
  String get profileSupport => 'Поддержка';

  @override
  String get securityCenterTitle => 'Центр безопасности';

  @override
  String get securityAccountSection => 'Аккаунт';

  @override
  String get securityEmailLabel => 'Email';

  @override
  String get securityGoogleLinkedLabel => 'Google аккаунт подключён';

  @override
  String get securityGoogleNotLinkedLabel => 'Google аккаунт не подключён';

  @override
  String get securitySessionsSection => 'Активные сеансы';

  @override
  String get securitySessionsEmpty => 'Активные сеансы не найдены';

  @override
  String get securitySessionCurrentBadge => 'Текущий';

  @override
  String get securitySessionRevokeButton => 'Выйти';

  @override
  String get securityLogoutAllButton => 'Выйти со всех устройств';

  @override
  String get securityLogoutAllConfirmTitle => 'Выйти со всех устройств?';

  @override
  String get securityLogoutAllConfirmMessage =>
      'Все сеансы будут завершены, потребуется повторный вход';

  @override
  String get securityDeleteAccountSection => 'Опасная зона';

  @override
  String get securityDeleteAccountButton => 'Удалить аккаунт';

  @override
  String get securityDeleteAccountConfirmTitle => 'Удалить аккаунт?';

  @override
  String get securityDeleteAccountConfirmMessage =>
      'Это действие нельзя отменить. Аккаунт будет удалён, все сеансы завершатся.';

  @override
  String get securityDeleteAccountWalletNotEmptyMessage =>
      'Перед удалением аккаунта потратьте баланс кошелька или обратитесь в поддержку — вывод средств из кошелька UZDONATE недоступен.';

  @override
  String get securityDeleteAccountSuccessMessage => 'Ваш аккаунт удалён';

  @override
  String get notificationsTitle => 'Уведомления';

  @override
  String get notificationsEmpty => 'Пока нет уведомлений';

  @override
  String get notificationsMarkAllRead => 'Отметить всё как прочитанное';
}
