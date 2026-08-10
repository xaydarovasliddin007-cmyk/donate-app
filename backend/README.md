# UZDONATE — Backend

REST API. Node.js + TypeScript + Fastify + Prisma + PostgreSQL. Modular monolith.

## Architecture

```
src/
  config/env.ts        zod-validated environment config (fails fast on boot if invalid)
  app.ts                Fastify app builder: plugins, routes, error handling
  server.ts             entrypoint: listen + graceful shutdown
  plugins/prisma.ts      registers a lazily-connecting PrismaClient on the app instance
  providers/              provider-adapter architecture (payment + topup), see below
  lib/
    logger.ts            pino logger (redacts secrets/tokens in log output)
    errors.ts            AppError hierarchy (ValidationError, UnauthorizedError, ...)
    validate.ts           zod preHandler for request bodies/query
    duration.ts            tiny "15m"/"30d" duration parser
    order-number.ts         human-readable order reference generator
    audit.ts                 admin audit-log writer
  middleware/authenticate.ts   customer JWT access-token verification preHandler
  modules/
    health/                /health (liveness) and /ready (readiness)
    auth/                    customer register/login/refresh/logout/me
    games/                    GET /games, /games/:id, /games/:id/products
    promotions/               GET /promotions
    orders/                    order creation/list/detail + state machine + fulfillment
    payments/                  payment intent creation + idempotent webhook processing
    saved-games/                "My Games" — saved Player ID/Server ID per game, for Quick Buy
    admin/                      separate admin auth (own JWT secret) + protected admin API
prisma/
  schema.prisma           Full domain model: users, admin users, games, products, providers,
                           orders, payments, webhooks, promotions, audit log
  seed.ts                   dev catalog seed (MLBB test products, dev admin, dev providers)
  migrations/                SQL migrations (generated via schema diffing, since no local
                              Postgres was available to run `prisma migrate dev` against —
                              verify with `prisma migrate deploy` once a DB is up)
```

Each module owns its routes/service/schemas; modules talk to the database through
`app.prisma` directly (no repository layer — would be premature at this size).

## Auth design

**Customer** (`/api/v1/auth/*`):
- **Access tokens**: short-lived JWTs (`JWT_ACCESS_TTL`, default 15m), signed with
  `JWT_ACCESS_SECRET`.
- **Refresh tokens**: opaque random strings, only their SHA-256 hash is stored in
  `refresh_tokens`. Rotated on every use; reuse of an already-rotated (revoked) token
  revokes the entire session family for that user (theft detection).
- **Passwords**: argon2id (OWASP-recommended parameters).
- **Google sign-in** (`POST /api/v1/auth/google`): the client sends the Google ID token from
  the Flutter `google_sign_in` flow; the backend verifies its signature, issuer, audience, and
  expiry against Google's own JWKS via `google-auth-library` (`src/modules/auth/google-token.ts`)
  — client-supplied identity claims are never trusted directly. An existing account is only
  linked by email when Google itself reports that email as verified; an unverified match
  always creates a fresh account instead of silently taking over an existing one. Returns
  `503 SERVICE_UNAVAILABLE` if `GOOGLE_CLIENT_ID` isn't configured (see "Google Sign-In setup"
  below) rather than failing to boot.

**Admin** (`/api/v1/admin/auth/*`): structurally identical (opaque rotated refresh tokens,
argon2id), but signed with a **separate secret** (`ADMIN_JWT_ACCESS_SECRET`) via `fast-jwt`
directly rather than a second `@fastify/jwt` registration (Fastify's `decorateRequest`
rejects re-declaring the same request property from a nested plugin — see
`src/modules/admin/admin-token.ts`). A leaked customer secret must never be enough to forge
admin access. Admin login is additionally rate-limited tighter than the API default.
RBAC roles: `SUPER_ADMIN`, `ADMIN`, `OPERATIONS`, `SUPPORT`, `FINANCE`, `CONTENT_MANAGER`.

## Order state machine

`src/modules/orders/order-state-machine.ts` is the single source of truth for valid
transitions — nothing else may update `Order.status` directly:

```
PENDING → PAID → PROCESSING → COMPLETED
PENDING → CANCELLED | FAILED
PAID → FAILED | REFUNDED
PROCESSING → FAILED
COMPLETED → REFUNDED
FAILED → PROCESSING   (admin "retry fulfillment" only, never customer-reachable)
```

Every transition is logged to `order_status_history`. Order creation requires
`idempotencyKey` (client-generated, stable across retries of the same checkout attempt) so a
flaky connection can never double-create an order.

## Payments & providers

Flutter never talks to a payment or top-up provider directly — only to this backend, which
talks to `PaymentProviderAdapter`/`TopupProviderAdapter` implementations
(`src/providers/`). Only a `DEV_MOCK_PAYMENT`/`DEV_MOCK_TOPUP` pair exists today; adding a
real provider (Payme, Click, Uzum, ...) is a new adapter file registered in
`src/providers/registry.ts` — order/payment logic never changes. Provider credentials would
live only in that adapter's own module, read from environment variables, never from the
client.

The dev payment provider never marks itself "succeeded" on its own — a payment starts
`PENDING` exactly like a real redirect-based gateway, and only a webhook-shaped event moves
it forward. In dev/test (`NODE_ENV !== 'production'`), `POST /payments/:id/dev-simulate`
stands in for that webhook, but it still runs through the exact same
`processPaymentWebhook()` idempotent-processing path a real provider's webhook would —
nothing is short-circuited. Webhook idempotency is enforced by a DB unique constraint on
`(provider, providerEventId)`, not by application-level "probably won't happen twice" logic.

## API surface

```
GET    /health                              liveness, never touches the DB
GET    /ready                                readiness, 503 if DB unreachable

POST   /api/v1/auth/register|login|refresh|logout
POST   /api/v1/auth/google                   real Google ID token verification, see below
GET    /api/v1/auth/me

GET    /api/v1/games
GET    /api/v1/games/:id
GET    /api/v1/games/:id/products
GET    /api/v1/promotions

POST   /api/v1/orders                        auth required
GET    /api/v1/orders
GET    /api/v1/orders/:id

POST   /api/v1/payments                      auth required
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/dev-simulate      dev/test only

GET    /api/v1/saved-games                   auth required — "My Games" for Quick Buy
PUT    /api/v1/saved-games/:gameId           auth required — {playerId, serverId?}
DELETE /api/v1/saved-games/:gameId           auth required

POST   /api/v1/admin/auth/login|refresh|logout
GET    /api/v1/admin/auth/me                  admin auth required
GET    /api/v1/admin/orders(?status=&limit=)
GET    /api/v1/admin/orders/:id
POST   /api/v1/admin/orders/:id/retry-fulfillment   SUPER_ADMIN/ADMIN/OPERATIONS only
GET    /api/v1/admin/users
GET    /api/v1/admin/products(?gameId=)
PATCH  /api/v1/admin/products/:id             {isActive?, amountMinor?} — elevated roles only
GET    /api/v1/admin/providers
GET    /api/v1/admin/payments/:id
GET    /api/v1/admin/stats
```

## Running

```bash
npm install
npm run prisma:generate
npm run prisma:deploy     # requires a reachable PostgreSQL — see ../docker-compose.yml
npm run prisma:seed        # dev catalog: games, MLBB products, dev providers, dev admin
npm run dev                 # http://localhost:4000
```

Dev admin login (seeded, change before any shared deploy): `admin@uzdonate.dev` /
`DevAdmin123!`.

## Commands

```bash
npm run dev          # tsx watch
npm run build         # tsc -> dist/
npm run typecheck      # tsc --noEmit
npm run lint            # eslint
npm test                 # vitest
npm run prisma:studio     # DB browser GUI
npm run prisma:seed        # (re-)run dev seed data — safe to re-run, upserts
```

## Google Sign-In setup

Not configured yet on this machine — `GOOGLE_CLIENT_ID` is unset, so `/auth/google` responds
`503` (this is by design, not a bug; see `test/auth-google-route.test.ts`). To enable it:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   OAuth 2.0 Client ID of type **Web application** (used as the `serverClientId` on the Flutter
   side — this is what lets the backend verify tokens as intended for *this* app). Copy its
   Client ID.
2. Create a second OAuth 2.0 Client ID of type **Android**, with this app's package name
   (`com.donateapp.donate_app`) and the SHA-1 fingerprint of the signing key (for local debug
   testing: `cd mobile/android && ./gradlew signingReport`, use the `debug` variant's SHA1).
3. Set `GOOGLE_CLIENT_ID` in `backend/.env` to the **Web** client ID from step 1.
4. Run the Flutter app with `--dart-define=GOOGLE_SERVER_CLIENT_ID=<same Web client ID>`.

Both the Web and Android client IDs must exist in the same GCP project for Android's native
Google Sign-In flow to hand back a token this backend can verify.

## Environment

See `.env.example` for the full list. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ADMIN_JWT_ACCESS_SECRET` (all three secrets must be ≥32 chars — the
app refuses to boot otherwise — and must all be *different* from each other).

## A note on error-handler registration order

`app.setErrorHandler`/`app.setNotFoundHandler` are registered **before** any routes/plugins
in `app.ts`. Fastify resolves each encapsulated context's error handler at the time its
routes are defined, not lazily per request — registering the custom handler after the nested
`/api/v1` route tree left those routes silently falling back to Fastify's default (differently
shaped) error output. Caught by `test/admin-auth.test.ts`. If you add new top-level
plugin/route registrations, keep the error handlers first.
