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
npm run dev              # http://localhost:4000
```

- `GET /health` — liveness (always 200 once the process is up, never touches the DB)
- `GET /ready` — readiness (503 if the database is unreachable)
- `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `GET /api/v1/auth/me`

Secrets live in `backend/.env` (gitignored); see `backend/.env.example` for the full list.

### 3. Mobile

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

`10.0.2.2` is the Android emulator's alias for the host machine's `localhost`. On a
physical device, use your machine's LAN IP instead.

## Build phases

Built incrementally; each phase is run, tested, and verified before moving to the next.

- [x] **Phase 1 — Foundation**: Flutter + backend + Postgres/Prisma scaffolding, env config,
      health/readiness endpoints, auth foundation (register/login/refresh/logout), localization
      (uz/ru, en-ready), theme system (light/dark/system, persisted, no startup flash), app shell.
- [ ] Phase 2 — Database + core backend (full domain schema: games, products, orders, etc.)
- [ ] Phase 3 — Authentication (hardened, full flows)
- [ ] Phase 4 — Game catalog
- [ ] Phase 5 — Customer Flutter UI
- [ ] Phase 6 — Order engine
- [ ] Phase 7 — Payment abstraction + integration layer
- [ ] Phase 8 — Top-up provider abstraction
- [ ] Phase 9 — Admin backend + admin UI
- [ ] Phase 10 — Notifications
- [ ] Phase 11 — Security hardening
- [ ] Phase 12 — Testing + performance optimization
- [ ] Phase 13 — Production deployment

See [`backend/README.md`](backend/README.md) and [`mobile/README.md`](mobile/README.md) for
module-specific detail.
