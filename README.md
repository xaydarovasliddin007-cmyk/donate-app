# Donate App

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

`10.0.2.2` is the Android emulator's alias for the host machine's `localhost`. On a
physical device, use your machine's LAN IP instead — see
[`mobile/README.md`](mobile/README.md) for the exact command.

## What's implemented (MVP)

- **Customer app**: splash → onboarding (language/theme) → home (search, popular games,
  categories, promotions, recent orders) → game details → player ID/server ID → checkout →
  order status → order history → profile. Guests can browse everything; buying requires an
  account. Auth tokens are stored in Android Keystore-backed secure storage, not
  SharedPreferences.
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

## Not implemented yet (by design)

- Real payment provider credentials/integrations (Payme, Click, Uzum, ...)
- Real top-up provider credentials/integrations
- Admin web UI
- Push notifications

## Build phases

Built incrementally; each phase is run, tested, and verified before moving to the next.

- [x] **Phase 1 — Foundation**: Flutter + backend + Postgres/Prisma scaffolding, env config,
      health/readiness endpoints, auth foundation, localization (uz/ru, en-ready), theme
      system (light/dark/system, persisted, no startup flash), app shell.
- [x] **MVP — Donate App core flow**: full domain schema (games, products, providers, orders,
      payments, webhooks, admin, audit log), order state machine, provider adapters (payment +
      topup, dev/mock implementations), admin API, and the complete customer Flutter app
      (auth, home, game details, checkout, order status/history, profile).
- [ ] Real payment/top-up provider integrations (pending credentials)
- [ ] Admin web UI
- [ ] Notifications
- [ ] Security hardening pass (beyond what's already in place — see backend README)
- [ ] Performance/load testing
- [ ] Production deployment

See [`backend/README.md`](backend/README.md) and [`mobile/README.md`](mobile/README.md) for
module-specific detail.
