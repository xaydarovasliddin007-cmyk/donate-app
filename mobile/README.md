# Donate App — Mobile

Customer-facing Flutter app. Android first, iOS-ready.

## Architecture

Feature-first, clean-ish architecture:

```
lib/
  core/
    config/          build-time config (API base URL via --dart-define)
    localization/    locale persistence/controller
    network/         API client (Dio) + typed ApiException
    router/          go_router setup
    storage/         SharedPreferences wrapper
    theme/           design tokens + ThemeData + theme persistence
    widgets/          shared loading/error/empty state widgets
  features/
    <feature>/
      presentation/  screens/widgets
      (data/, domain/ added as features grow)
  l10n/
    arb/             translation source files (app_uz.arb, app_ru.arb)
    generated/        flutter gen-l10n output (do not edit by hand)
  app.dart            MaterialApp.router wiring
  main.dart            bootstrap: load prefs, avoid theme flash, runApp
```

- **State management**: Riverpod (plain `Notifier`/`Provider`, no code generation — kept
  simple for now; revisit `riverpod_generator` if boilerplate grows).
- **Routing**: `go_router`.
- **Never hardcode user-facing text** — add a key to `lib/l10n/arb/app_uz.arb` (the
  template) and `app_ru.arb`, then run `flutter gen-l10n`.

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

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

## Commands

```bash
flutter analyze          # static analysis
flutter test              # unit + widget tests
flutter gen-l10n          # regenerate AppLocalizations after editing ARB files
dart run flutter_native_splash:create   # regenerate native splash assets after config change
```
