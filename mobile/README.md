# UZDONATE — Mobile

Customer-facing Flutter app. Android first, iOS-ready.

## Architecture

Feature-first, clean-ish architecture:

```
lib/
  core/
    branding/         AppBranding (name) + BrandMark (vector logo, no image asset/emoji)
    config/          build-time config (API base URL + Google client ID via --dart-define)
    errors/           Failure — maps ApiException to presentation-facing title/message
    localization/     locale persistence/controller
    network/          API client (Dio): auth header injection, refresh-on-401, error mapping
    router/           go_router: splash/onboarding/auth routes + bottom-nav shell
    storage/          SharedPreferences (prefs) + flutter_secure_storage (auth tokens)
    theme/            design tokens + ThemeData + theme persistence
    utils/             money formatting, idempotency key generation
    widgets/           shared loading/error/empty state widgets
  features/
    splash/, onboarding/, auth/, home/, games/, orders/, payments/, saved_games/, profile/,
    wallet/, topup/, notifications/
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
- Google sign-in (`features/auth/data/google_sign_in_service.dart`) wraps the `google_sign_in`
  v7 singleton API and returns an ID token, which `AuthController.signInWithGoogle()` sends to
  the backend's `/auth/google` for verification — the app never trusts Google identity data
  itself, only whatever OUR backend hands back after verifying it. Disabled gracefully (button
  still visible, shows a friendly "not configured" message instead of crashing) until
  `GOOGLE_SERVER_CLIENT_ID` is provided — see `backend/README.md`'s "Google Sign-In setup".

## Purchase flow

Home → game details → player ID/server ID → checkout (creates the order, then a payment
intent) → order status. Checkout offers two payment methods: the UZDONATE wallet (shows the
current balance inline, calls `POST /payments/wallet`) or the dev/mock payment provider.
`INSUFFICIENT_BALANCE` is handled as a distinct case — not a generic error — surfacing a
"Top up now" link straight to `/wallet/topup` instead of just failing the order. The order
status screen polls lightly (3s) while the order is in a non-terminal state, and — only in dev
builds, when the backend's dev/mock payment provider is active — shows "simulate success/fail"
buttons standing in for a real payment gateway's webhook. See `backend/README.md` for why
that's not "faking a payment".

## Wallet, top-up & security

- **Wallet** (`features/wallet/`): balance card on Home (only shown when signed in) and a
  transaction history screen (`/wallet/history`). Balance is always read from the backend —
  never computed or cached client-side beyond a single Riverpod `FutureProvider`.
- **Top-up** (`features/topup/`): `/wallet/topup` lists admin-configured receiving cards and
  submits a top-up request. The UI is explicit that crediting only happens after admin
  verification — there is no "mark as paid" affordance on the client.
- **Public UZDONATE ID**: shown in Profile near the Settings section (not at the top, by
  design) with copy-to-clipboard (`features/profile/presentation/widgets/public_id_row.dart`).
- **Security Center** (`/security`): active sessions/devices with per-session revoke and
  "log out everywhere", whether a Google account is linked, and self-service account deletion
  (`core/network` → `POST /auth/account/delete-request`) — blocked with a clear message while
  the wallet balance is non-zero, since the wallet has no withdrawal path.
- **Notifications** (`/notifications`): real, DB-backed notification list with unread-count
  badge on Home's bell icon and mark-as-read/mark-all-read.
- **Support** (`core/utils/support_launcher.dart`): the order status screen's "Contact support"
  button opens Telegram (`SUPPORT_TELEGRAM_USERNAME` dart-define) or falls back to email
  (`SUPPORT_EMAIL`), with the UZDONATE ID, order number, game, product, and status pre-filled
  in the message — the user never has to type these.

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

Physical Android device over **USB** (avoids the LAN-IP/network hassle entirely — recommended):

```bash
adb reverse tcp:4000 tcp:4000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
```

This forwards the phone's `localhost:4000` to your computer's `localhost:4000` over the USB
connection, so it keeps working across networks and doesn't need the LAN IP at all. Re-run
`adb reverse` if you unplug/replug the device. Confirm the backend is reachable first with
`curl http://localhost:4000/health` on the computer.

## Production build size

`android/app/build.gradle.kts`'s `release` build type enables R8 code shrinking and resource
shrinking (`isMinifyEnabled` / `isShrinkResources`), with `android/app/proguard-rules.pro`
covering the two things known to break under R8 without an explicit keep rule: Google Sign-In's
credential classes and `flutter_secure_storage`'s AndroidX Security Crypto usage. **Verify Google
Sign-In on a real device after any proguard-rules.pro change** — a missing keep rule fails at
sign-in time, not at build time.

Measured (`flutter build apk --release --target-platform=android-arm64 --analyze-size`):
single-ABI release APK is **~19 MB**, comfortably under a 30–50 MB target. The Flutter engine +
framework (`libflutter.so`, `package:flutter`) accounts for the large majority of that — the
app's own Dart code (`package:donate_app`) is ~239 KB, and bundled assets are ~150 KB total
(icon font is tree-shaken 99.5% by Flutter's build system automatically). There's no realistic
lever left to shrink this further without dropping Flutter itself.

The `.aab` (`flutter build appbundle --release`) is ~52 MB as a **raw upload artifact** because
it bundles all four ABIs (arm64-v8a, armeabi-v7a, x86, x86_64) for Play Store to split from —
that number is never what an end user downloads. Play App Signing delivers only the one matching
ABI split per device, landing close to the ~19 MB single-ABI figure above.

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
