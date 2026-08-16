# UZDONATE

A fast, premium gaming top-up platform. Uzbekistan first, Central Asia next, global later.

Competitive advantage: **extreme speed** — open app → choose game → enter player ID → choose package → pay → automatic processing → instant status.

## Stack

- **Mobile**: Flutter + Dart (Riverpod, go_router)
- **Backend**: Node.js + TypeScript (Fastify, modular monolith)
- **Database**: PostgreSQL + Prisma
- **Architecture**: modular monolith, structured so modules can be extracted into services later if the platform grows — no microservices/Kubernetes/Kafka until there's a real demonstrated need.

## Repo layout

```
backend/   REST API (Fastify + TypeScript + Prisma)
mobile/    Customer-facing Flutter app
admin/     Admin web panel (React + Vite + TypeScript)
docs/      Architecture / product notes
docker-compose.yml   Local PostgreSQL for development
```

## Getting started

### 1. Database

```bash
docker compose up -d
```

This starts PostgreSQL 16 on `localhost:5432` (user/password/db: `donate`/`donate`/`donate_app`).
No Docker on this machine yet — install Docker Desktop (or point `DATABASE_URL` in
`backend/.env` at any reachable Postgres 14+ instance) before running migrations.

### 2. Backend

```bash
cd backend
npm install
npm run prisma:deploy   # applies prisma/migrations against DATABASE_URL
npm run prisma:seed      # dev catalog: games, MLBB test products, dev admin
npm run dev               # http://localhost:4000
```

See [`backend/README.md`](backend/README.md) for the full API surface (games, orders,
payments, admin) and the auth/order/payment design.

### 3. Mobile

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

`10.0.2.2` is the Android emulator's alias for the host machine's `localhost`. For a physical
device over USB (recommended — no LAN/network hassle):

```bash
adb reverse tcp:4000 tcp:4000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000/api/v1
```

See [`mobile/README.md`](mobile/README.md) for the LAN-IP alternative and more detail.

### 4. Admin panel

```bash
cd admin
npm install
cp .env.example .env   # VITE_API_BASE_URL defaults to http://localhost:4000/api/v1
npm run dev             # http://localhost:3000
```

Sign in with the dev admin seeded by `npm run prisma:seed` (see `backend/prisma/seed.ts` for
the seeded email/password). `CORS_ORIGIN` in `backend/.env` already defaults to
`http://localhost:3000` to match the admin panel's dev server port.

## What's implemented (MVP)

- **Customer app**: splash → onboarding (language/theme) → home (search, popular games,
  categories, promotions, recent orders) → game details → player ID/server ID → checkout →
  order status → order history → profile. Guests can browse everything; buying requires an
  account. Auth tokens are stored in Android Keystore-backed secure storage, not
  SharedPreferences.
- **Authentication**: email/password, and real Google Sign-In — the backend verifies Google ID
  tokens (signature/issuer/audience/expiry) against Google's own keys via `google-auth-library`
  rather than trusting whatever the client claims; only genuinely verified emails can link to
  an existing account. Fully implemented, but inert until a Google Cloud OAuth client is
  configured (see "External credentials still needed" below) — the button shows a friendly
  message instead of crashing when unconfigured.
- **Catalog**: Mobile Legends is the one fully working game with seeded dev/test products.
  Other games (PUBG Mobile, Free Fire, Roblox, Valorant) are seeded as "coming soon" —
  the catalog structure is generic, adding a real game is just data.
- **Orders**: explicit state machine (`PENDING → PAID → PROCESSING → COMPLETED`, with
  `FAILED`/`CANCELLED`/`REFUNDED` branches), idempotency keys, full status history.
- **Payments**: provider-adapter architecture; a dev/mock payment provider stands in until
  real credentials for Payme/Click/Uzum etc. are available. Nothing is ever silently marked
  "paid" — the dev provider still goes through the same webhook-processing path a real one
  would, just triggered manually from the order status screen instead of by a real gateway.
- **Fulfillment**: same adapter pattern for the top-up/game-credit provider side, with
  automatic multi-provider fallback support built into the schema (`ProviderProduct.priority`)
  even though only one dev provider exists today.
- **Admin API + web panel**: separate authentication (own JWT secret, own login), RBAC roles,
  endpoints for orders/users/wallets/top-ups/products/providers/payments/receiving-methods/
  admins/audit-logs/stats, audit-logged sensitive actions (`writeAuditLog`, immutable
  `AuditLog` table, browsable in the panel). A React/Vite admin panel (`admin/`) covers
  dashboard analytics, user search + wallet detail, order detail/refund/retry, top-up
  verification queue, receiving-method (card) management, product pricing/activation, an
  audit-log viewer, and SUPER_ADMIN-only admin account management.
- **My Games / Quick Buy**: a Player ID/Server ID is saved automatically per game after a
  successful order (`saved_player_profiles`, one row per user+game). The home screen's "My
  Games" section surfaces these with a one-tap Quick Buy straight to checkout — no re-typing,
  no product-selection screen — and the player-info form pre-fills from the saved profile when
  buying the normal way.
- **UZDONATE wallet**: a closed-loop, ledger-based wallet (no P2P, no withdrawal, no cash-out).
  Every balance change is an immutable `WalletTransaction` row, applied by a single atomic
  `UPDATE ... WHERE balance + delta >= 0` statement (`wallet.service.ts`) — never a bare balance
  write, and idempotency-key-protected so a retried webhook or double-tapped admin action can
  never double-apply. A permanent, public "UZD-XXXXXXXX" ID is shown in Profile (near Settings,
  with copy-to-clipboard) without ever exposing the internal user ID.
- **UZDONATE card-transfer top-up**: users submit a top-up request against an admin-configured
  receiving card (never hardcoded — `ReceivingMethod` rows, managed from the admin panel). The
  wallet is credited **only** after an admin explicitly verifies the transfer against a real
  bank statement — the user's own claim ("I paid") is never sufficient by itself.
- **Wallet as a payment method**: checkout offers "Pay with wallet" alongside the existing
  dev/mock payment provider. Insufficient balance surfaces a distinct `INSUFFICIENT_BALANCE`
  error (not a generic failure) so the app can offer a "Top up now" CTA instead of failing the
  order outright.
- **Security Center**: active session/device list (backed by the existing `RefreshToken` table),
  per-session revoke, "log out everywhere," Google-linked-account status, and self-service
  account deletion (soft-delete; blocked with a clear message while the wallet balance is
  non-zero, since the closed-loop wallet has no withdrawal path) — reachable from Profile.
- **Support**: an order's status screen has a "Contact support" action that opens Telegram (or
  email, if Telegram isn't configured) with the UZDONATE ID, order number, game, product, and
  status pre-filled — never asks the user to type these manually.
- **In-app notifications**: a real, DB-backed notification center (order success/failure,
  payment success, top-up success, refund, security events) — not a stub. Push delivery via
  Firebase Cloud Messaging is architected for but not wired (see "Not implemented yet" below).
- **Telegram admin alerts**: real, env-gated Telegram Bot API notifications
  (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID`) for new orders, payments, top-up requests,
  successes/failures, and refunds. Fire-and-forget — never blocks the request it's reporting on,
  and silently no-ops when unconfigured rather than crashing.

## Not implemented yet (by design)

- Real payment provider credentials/integrations (Payme, Click, Uzum, ...)
- Real top-up provider credentials/integrations
- Push notifications (Firebase Cloud Messaging) — architecture only; in-app notifications are
  real, FCM delivery is not wired
- Native app icon / launcher icon assets (in-app branding uses a vector mark; no image-editing
  tool is available in this environment to author real icon PNGs)
- Admin panel: Telegram config UI (still env-based) and Analytics beyond the dashboard's basic
  breakdowns. Admins/RBAC management and an audit-log viewer are now built.

## External credentials/configuration still needed

Nothing above is blocked on code — only on operator-provided configuration:

| What | Where it plugs in | Needed for |
|---|---|---|
| PostgreSQL instance | `backend/.env` → `DATABASE_URL` | Everything DB-backed (this dev machine has none installed) |
| Google Cloud OAuth Client IDs (Web + Android) | `backend/.env` → `GOOGLE_CLIENT_ID`, Flutter `--dart-define=GOOGLE_SERVER_CLIENT_ID` | Google Sign-In — see `backend/README.md` "Google Sign-In setup" for exact steps |
| Payme/Click/Uzum (or other) merchant credentials | New adapter in `backend/src/providers/`, registered in `registry.ts` | Real payments — architecture is ready, no real provider is wired |
| Game top-up provider API credentials | Same adapter pattern, `TopupProviderAdapter` | Real fulfillment — same story |
| Firebase project | Not yet wired into the app | Push notifications |
| Telegram bot token + chat ID | `backend/.env` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | Admin Telegram alerts — silently disabled without these, never crashes |
| At least one real `ReceivingMethod` row | Admin panel → Receiving methods, or `POST /api/v1/admin/receiving-methods` | Card-transfer top-up to actually be usable in production (dev seed adds a placeholder only) |
| A real support Telegram username or support inbox | Flutter `--dart-define=SUPPORT_TELEGRAM_USERNAME=...` (or `SUPPORT_EMAIL`) | The in-app "Contact support" action — defaults to a placeholder email until set |

## Build phases

Built incrementally; each phase is run, tested, and verified before moving to the next.

- [x] **Phase 1 — Foundation**: Flutter + backend + Postgres/Prisma scaffolding, env config,
      health/readiness endpoints, auth foundation, localization (uz/ru, en-ready), theme
      system (light/dark/system, persisted, no startup flash), app shell.
- [x] **MVP — core flow**: full domain schema (games, products, providers, orders,
      payments, webhooks, admin, audit log), order state machine, provider adapters (payment +
      topup, dev/mock implementations), admin API, and the complete customer Flutter app
      (auth, home, game details, checkout, order status/history, profile).
- [x] **UZDONATE rebrand + Google Sign-In**: centralized branding (vector logo, no image
      asset/emoji), real Google ID token verification end to end (backend verifies against
      Google's own keys; Flutter wired via `google_sign_in` v7) — inert until a GCP OAuth
      client is configured, see "External credentials still needed" above.
- [x] **Wallet, top-up, admin panel**: ledger-based wallet with public UZDONATE ID, admin-only
      verified card-transfer top-up, wallet-as-payment-method in checkout, Security Center
      (sessions/Google-link status), real in-app notifications, env-gated Telegram admin
      alerts, and a React/Vite admin web panel (dashboard, users/wallets, orders, top-up
      verification queue, receiving methods, products, providers).
- [ ] Real payment/top-up provider integrations (pending credentials)
- [ ] Push notifications (Firebase Cloud Messaging delivery)
- [ ] Security hardening pass (beyond what's already in place — see backend README)
- [ ] Performance/load testing
- [ ] Production deployment

See [`backend/README.md`](backend/README.md) and [`mobile/README.md`](mobile/README.md) for
module-specific detail.
