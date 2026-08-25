# UZDONATE — Project Status (for a new agent / Codex session)

This file is a snapshot for whoever picks up work on this repo next — written to be
self-contained, not requiring the rest of the conversation history that produced it.

## What this is

UZDONATE — a game top-up platform for Uzbekistan (Central Asia next). Users buy in-game
currency (diamonds, UC, etc.) for popular mobile games, paid for either via a closed-loop
in-app wallet or directly at checkout. The wallet itself is funded either manually (admin
reviews a bank statement) or **automatically** via a real card-transfer detection system
(see "Card-transfer auto top-up" below — this is the most recently built, most novel part
of the system, and the one most worth reading closely before touching).

## Stack & repo layout

```
backend/   REST API — Node.js + TypeScript + Fastify, modular monolith, Prisma + PostgreSQL
mobile/    Customer app — Flutter + Dart, Riverpod, go_router
admin/     Admin web console — React + Vite + TypeScript, hand-rolled i18n (uz/ru/en)
docs/      This file, plus whatever else lands here
docker-compose.yml   Local PostgreSQL for dev
```

- `backend/README.md` — full API surface, auth design, provider-adapter pattern, setup
  instructions per optional integration (Payme, Click, Digiflazz, Google, SMTP, Humo).
- `README.md` (repo root) — original MVP feature list and phase history; useful for the
  broad strokes but **written before the card-transfer auto-verification system and the
  mobile/admin design passes described below** — treat anything here as more current where
  the two disagree.

Backend modules live under `backend/src/modules/`: `auth`, `games`, `orders`, `payments`,
`topup`, `wallet`, `promotions`, `saved-games`, `notifications`, `admin`, `health`. Each
owns its own routes/service/schemas; no repository layer, no microservices — a modular
monolith by deliberate choice at this size.

## Recurring pattern: "wired but inert without credentials"

Nearly every external integration in this codebase follows the same shape: the real
integration code is fully written and type-checked, but self-disables (a friendly error,
never a crash, never fake success) until the operator supplies real credentials in
`backend/.env`. This applies to Google Sign-In, Payme, Click, Digiflazz, Apigames, SMTP,
and the Telegram admin-alert bot. **Never fake a success path to work around a missing
credential** — that norm is enforced throughout the codebase and should stay that way.

## What's actually live right now (not just wired)

- **Card-transfer auto top-up**, end to end, tested with real money (see below).
- **Google Sign-In**: `GOOGLE_CLIENT_ID` is set — real OAuth verification against Google's
  own keys.
- **SMTP email** (registration verification codes): a real Gmail account is configured.
- **~18 games seeded**, several with real per-server pricing (Mobile Legends) and priced
  test products (8 Ball Pool and others) — not just Mobile Legends anymore.

## What's still inert (needs credentials, not code)

Payme, Click, Digiflazz, Apigames, and the Telegram **admin-alert** bot (`TELEGRAM_BOT_TOKEN`
/ `TELEGRAM_ADMIN_CHAT_ID` — distinct from the Humo userbot below) are all fully coded but
have no real credentials in `backend/.env` yet. Selecting Payme/Click at checkout, for
example, correctly surfaces "currently unavailable" rather than doing anything fake.

## Card-transfer auto top-up — the newest, most important system

The core idea (matches how Uzpin and similar Uzbek top-up bots work): a user states an
exact amount they want to add to their wallet, the app shows them every currently-active
receiving card, they transfer that exact amount to any one of them from their own banking
app, and the balance is credited **automatically**, no admin step, within seconds.

**How disambiguation works** (this is the part worth understanding before changing
anything): rather than locking one card exclusively to one user's request, every request
gets a **globally-unique amount** — `reserveTopUpRequest()` in
`backend/src/modules/topup/topup.service.ts` bumps the requested amount by a few tiyin if
another live PENDING request already claimed the exact figure. `TopUpRequest.receivingMethodId`
is nullable and stays null until a matching transaction (or a manual admin review) actually
identifies which card was used. A reservation is a `TopUpRequest` row with `expiresAt` set,
currently a **7-minute** TTL (`RESERVATION_TTL_MS`).

**How detection works**: a personal Telegram account (a real user account, not a Bot-API
bot — bots can't read another bot's DMs) is automated via GramJS
(`backend/scripts/humo-listener.ts`) to watch `@HUMOcardbot`'s own notification messages to
that account. When a transfer notification arrives, the script parses the amount and a
card-hint, then POSTs to `POST /api/v1/payments/webhooks/humo-transaction` with a shared
secret (`HUMO_WEBHOOK_SECRET`). The backend (`autoVerifyFromCardTransaction()`) only credits
a wallet when **both** (a) the card in the notification is one of our own currently-active
`ReceivingMethod` rows, and (b) exactly one PENDING, non-expired request has that exact
amount. Anything else — no match, or more than one match — is left alone for manual admin
review (`admin/` → "Пополнения" / Top-ups page, already has full Verify/Reject actions).

**Current live configuration**: 3 real Humo cards are configured as active `ReceivingMethod`
rows with their full card numbers (not masked — the customer needs the complete number to
actually make the transfer; masking was a design mistake caught and fixed this session).
`TELEGRAM_API_ID`/`TELEGRAM_API_HASH`/`TELEGRAM_SESSION` are set and the listener has been
logged in once already (session string persists — no re-login needed unless it's revoked).
This has been verified end to end with a real 1000 so'm transfer, including catching and
fixing a real parser bug (the bot's amount format `"1.000,00 UZS"` uses a dot as thousands
separator and comma for the 2-digit tiyin part — European-style, not `"1,000.00"` US-style,
which the first parser version got backwards and would have overcredited by 100x had it not
been caught in that live test).

**To restart the listener** (e.g. after a machine reboot): `cd backend && npx tsx
scripts/humo-listener.ts` — it should NOT prompt for login again since `TELEGRAM_SESSION` is
saved. If it does prompt, that must be completed by the account owner personally (phone
code / 2FA) — never by an agent, per this repo's security norms.

**Known accepted tradeoffs, not bugs**:
- A narrow race window in `pickUniqueAmount()` where two simultaneous reservations could
  theoretically both compute the same free amount before either commits. This never causes
  a wrong credit — it just falls back to the existing "ambiguous match, needs manual
  review" path.
- The manual admin-verify path (`verifyTopUpRequest`) doesn't currently let the admin
  record which card was actually used — `receivingMethodId` stays null for manually-verified
  reservation-flow requests. Only the automatic path records it. Not solved yet; a
  reasonable next step if this data is needed for accounting.

## Mobile app — recent design work

The whole app already has a considered dark-mode-first design system (custom theme,
gradient brand accents, `PressableScale`, `StaggeredEntrance`, skeleton loaders,
`AppMotion`-driven consistent timing) — this was NOT a recent addition, it predates this
session's polish pass. What changed most recently:

- Order history got status filter chips; login screen got brought up to the same
  animation/field-styling standard as the rest of auth; every remaining stock
  Material widget (`ChoiceChip`, `SegmentedButton`) was replaced with branded equivalents
  (`core/widgets/selectable_chip.dart`, `core/widgets/segmented_pill.dart`).
- The top-up screen was reworked for the multi-card reservation flow described above: shows
  every active card (not one), a bold exact-amount warning, a copy button per card and for
  the amount, and an "I've paid" button that is **purely a UX acknowledgment** — it never
  credits anything itself, it just changes the waiting copy. Only a matched bank transaction
  (or admin) credits the wallet.
- Checkout's payment-method list now shows real Wallet/Payme/Click tiles (animated,
  staggered entrance, gradient icon badge when selected) instead of a "mock" tile sitting
  next to real ones. The dev-only simulated-payment path still exists but only appears
  behind `kDebugMode`, never to a real build.

## Admin panel — recent design work

Already had a genuinely well-developed dark design system (CSS custom properties, `.btn`/
`.badge`/`.panel`/`.data-table` etc., custom modals/toasts/skeletons) before this session.
Recent polish: `isActive` booleans across Receiving Methods/Admins/Game Servers/
Products/Providers now render as colored `ActiveBadge` pills instead of plain text, and
deactivating a receiving card, game server, product, or provider now requires confirming
in a dialog first — deactivating a receiving card in particular could silently orphan
pending card-transfer top-ups if done by accident.

## Local dev environment on this specific machine

- Windows 11. Flutter Windows-desktop target exists in the repo but **cannot actually
  build** here — no Visual Studio C++ toolchain installed (`flutter doctor` flags this).
- No Android emulator existed until this session created one (`uzdonate_test`, via
  `avdmanager`/AVD from an already-downloaded `google_apis_playstore_ps16k` system image) —
  it now exists and boots fine, but wasn't there by default.
- Flutter web (`flutter run -d chrome`) works fine when launched to the user's real Chrome;
  it does NOT work inside this agent's own sandboxed browser-preview tool (CanvasKit's
  runtime fetch to `gstatic.com` is blocked by that sandbox specifically, confirmed via a
  controlled `curl` test — not a general network problem).
- Backend dev server: `cd backend && npm run dev` (port 4000, `tsx watch`, auto-restarts on
  file changes — no need to manually restart after editing `src/`).
- Admin panel dev server: `cd admin && npm run dev` (port 3000).
- Dev admin login: `admin@uzdonate.dev` / `DevAdmin123!` (seeded by `npm run prisma:seed`).

## Suggested next steps (not started, no strong opinion on priority)

- Real Payme/Click merchant credentials, when available, just need to go in
  `backend/.env` — no code changes required, per the "wired but inert" pattern.
- The admin manual-verify path could be extended to let the admin record which card a
  transfer landed on (see "known accepted tradeoffs" above).
- Push notifications (Firebase Cloud Messaging) are architected for but not wired — in-app
  notifications are real and DB-backed already.
- No CI workflow exists in this repo (`.github/workflows/` is absent) — tests are only ever
  run locally so far.
