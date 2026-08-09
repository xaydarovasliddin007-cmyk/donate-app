# Donate App — Mobile

Customer-facing Flutter app. Android first, iOS-ready.

## Architecture

Feature-first, clean-ish architecture:

```
lib/
  core/
    config/          build-time config (API base URL via --dart-define)
    errors/           Failure — maps ApiException to presentation-facing title/message
    localization/     locale persistence/controller
    network/          API client (Dio): auth header injection, refresh-on-401, error mapping
    router/           go_router: splash/onboarding/auth routes + bottom-nav shell
    storage/          SharedPreferences (prefs) + flutter_secure_storage (auth tokens)
    theme/            design tokens + ThemeData + theme persistence
    utils/             money formatting, idempotency key generation
    widgets/           shared loading/error/empty state widgets
  features/
    splash/, onboarding/, auth/, home/, games/, orders/, payments/, profile/
      presentation/   screens/widgets
      data/            API clients (thin wrappers over ApiClient)
      domain/           models
      application/       Riverpod providers/controllers
  l10n/
    arb/              translation source files (app_uz.arb is the template, app_ru.arb)
    generated/         flutter gen-l10n output (do not edit by hand)
  app.dart              MaterialApp.router wiring
  main.dart              bootstrap: load prefs, avoid theme flash, runApp
```

- **State management**: Riverpod (plain `Notifier`/`AsyncNotifier`/`Provider`, no code
  generation — kept simple; revisit `riverpod_generator` if boilerplate grows).
- **Routing**: `go_router` with `StatefulShellRoute.indexedStack` for the Home/Orders/Profile
  bottom nav (each tab keeps its own stack/scroll position).
- **Never hardcode user-facing text** — add a key to `lib/l10n/arb/app_uz.arb` (the
  template) and `app_ru.arb`, then run `flutter gen-l10n`.

## Auth & networking

- Access/refresh tokens live in `flutter_secure_storage` (Android Keystore-backed), never
  SharedPreferences. `ApiClient` caches the access token in memory so it isn't re-read from
  the Keystore on every request.
- `ApiClient` attaches `Authorization: Bearer <token>` automatically and transparently
  refreshes once on a 401 before giving up; if refresh fails it clears tokens and calls
  `onSessionExpired`, which `AuthController` wires to drop the app back to guest state.
- Guests can browse the entire catalog. Buying (or viewing order history) prompts login —
  browsing is never gated.

## Purchase flow

Home → game details → player ID/server ID → checkout (creates the order, then a payment
intent) → order status. The order status screen polls lightly (3s) while the order is in a
non-terminal state, and — only in dev builds, when the backend's dev/mock payment provider is
active — shows "simulate success/fail" buttons standing in for a real payment gateway's
webhook. See `backend/README.md` for why that's not "faking a payment".

## Localization

Ships with Uzbek and Russian today; English/others are additive (add `app_en.arb`,
list it in `lib/core/localization/locale_controller.dart`'s `supportedLocales`).
Uzbek is not one of Flutter's built-in `MaterialLocalizations` languages, so framework
chrome (date pickers, etc.) falls back to English there — only affects framework widgets,
not app strings.

## Theme

Light/dark/system, persisted via `SharedPreferences`. `main.dart` holds the native splash
screen (via `flutter_native_splash`) until the persisted theme/locale are loaded, so there's
no flash of the wrong theme on cold start.

## Running

Android emulator:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

Physical Android device — use your computer's LAN IP instead of `10.0.2.2` (find it with
`ipconfig` on Windows), and make sure the phone and computer are on the same network and the
backend is bound to `0.0.0.0` (it is, by default):

```bash
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:4000/api/v1
```

The LAN IP isn't guaranteed stable across networks/reboots — re-check it if the app can't
reach the backend.

## Commands

```bash
flutter analyze          # static analysis
flutter test              # unit + widget tests
flutter build apk --debug   # debug APK, for a real device (see above)
flutter gen-l10n          # regenerate AppLocalizations after editing ARB files
dart run flutter_native_splash:create   # regenerate native splash assets after config change
```

## Known Android build note

`flutter_secure_storage` requires `compileSdk 37`; `android/app/build.gradle.kts` pins this
explicitly since Flutter's own default hadn't caught up as of this Flutter version.
