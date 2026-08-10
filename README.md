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
- **Admin API**: separate authentication (own JWT secret, own login), RBAC roles, endpoints
  for orders/users/products/providers/payments/stats, audit-logged sensitive actions. No
  admin UI yet — API only, by design (see Definition of Done in the project brief).
- **My Games / Quick Buy**: a Player ID/Server ID is saved automatically per game after a
  successful order (`saved_player_profiles`, one row per user+game). The home screen's "My
  Games" section surfaces these with a one-tap Quick Buy straight to checkout — no re-typing,
  no product-selection screen — and the player-info form pre-fills from the saved profile when
  buying the normal way.

## Not implemented yet (by design)

- Real payment provider credentials/integrations (Payme, Click, Uzum, ...)
- Real top-up provider credentials/integrations
- Admin web UI
- Push notifications (Firebase Cloud Messaging)
- Native app icon / launcher icon assets (in-app branding uses a vector mark; no image-editing
  tool is available in this environment to author real icon PNGs)

## External credentials/configuration still needed

Nothing above is blocked on code — only on operator-provided configuration:

| What | Where it plugs in | Needed for |
|---|---|---|
| PostgreSQL instance | `backend/.env` → `DATABASE_URL` | Everything DB-backed (this dev machine has none installed) |
| Google Cloud OAuth Client IDs (Web + Android) | `backend/.env` → `GOOGLE_CLIENT_ID`, Flutter `--dart-define=GOOGLE_SERVER_CLIENT_ID` | Google Sign-In — see `backend/README.md` "Google Sign-In setup" for exact steps |
| Payme/Click/Uzum (or other) merchant credentials | New adapter in `backend/src/providers/`, registered in `registry.ts` | Real payments — architecture is ready, no real provider is wired |
| Game top-up provider API credentials | Same adapter pattern, `TopupProviderAdapter` | Real fulfillment — same story |
| Firebase project | Not yet wired into the app | Push notifications |

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
- [ ] Real payment/top-up provider integrations (pending credentials)
- [ ] Admin web UI
- [ ] Notifications
- [ ] Security hardening pass (beyond what's already in place — see backend README)
- [ ] Performance/load testing
- [ ] Production deployment

See [`backend/README.md`](backend/README.md) and [`mobile/README.md`](mobile/README.md) for
module-specific detail.
