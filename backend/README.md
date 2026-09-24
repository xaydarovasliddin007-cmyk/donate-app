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
    public-id.ts             permanent "UZD-XXXXXXXX" public user ID generator
    money.ts                 integer-minor-units money formatting for Telegram/notification text
    telegram.ts               fire-and-forget Telegram Bot API admin alerts (env-gated)
  middleware/authenticate.ts   customer JWT access-token verification preHandler
  modules/
    health/                /health (liveness) and /ready (readiness)
    auth/                    customer register/login/refresh/logout/me, sessions, Google sign-in
    games/                    GET /games, /games/:id, /games/:id/products
    promotions/               GET /promotions
    orders/                    order creation/list/detail + state machine + fulfillment + refunds
    payments/                  payment intent creation + wallet payment + idempotent webhook
    saved-games/                "My Games" — saved Player ID/Server ID per game, for Quick Buy
    wallet/                      ledger-based wallet: balance + transaction history
    topup/                       UZDONATE card-transfer top-up requests + admin-configured
                                  receiving methods
    notifications/                real in-app notification center (DB-backed)
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
RBAC roles: `SUPER_ADMIN`, `ADMIN`, `OPERATIONS`, `SUPPORT`, `FINANCE`, `CONTENT_MANAGER`. New
admins are created only by an existing `SUPER_ADMIN` (`POST /admin/admins`) — there is no
public admin registration endpoint.

`refresh()` re-checks `user.status === 'ACTIVE'` on every call (not just at login) — a
suspended/deleted account's refresh token stops working immediately instead of continuing to
mint fresh access tokens until it expires on its own.

**Account deletion** (`POST /auth/account/delete-request`): soft-deletes only (`status =
'DELETED'`) — orders/payments/ledger history are never hard-deleted, for audit and financial
reasons. Blocked with `409 WALLET_NOT_EMPTY` while the wallet balance is non-zero, since the
wallet has no withdrawal path (see "Wallet & ledger design" below) — the user must spend the
balance or ask support to settle it first.

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

## Wallet & ledger design

The UZDONATE wallet is **closed-loop**: users can top up (via admin-verified card transfer) and
spend on purchases, but there is no P2P transfer, withdrawal, or cash-out anywhere in the API.

- `Wallet.balanceMinor` is a cached, denormalized value — the source of truth is the sum of
  `WalletTransaction` rows. Every transaction snapshots `balanceAfterMinor` at write time.
- `walletService.applyLedgerEntry()` (`src/modules/wallet/wallet.service.ts`) is the **only**
  function in the codebase allowed to change a balance. The balance update and the
  negative-balance guard happen in one atomic `UPDATE wallets SET balance_minor = balance_minor
  + $delta WHERE balance_minor + $delta >= 0 RETURNING ...` — Postgres guarantees two concurrent
  debits can never both succeed past a balance neither could individually afford, with no
  explicit row lock needed.
- `idempotencyKey` has a DB unique constraint, so a retried webhook, a double-tapped admin
  action, or two racing requests can never apply the same ledger entry twice — the losing
  request gets back the entry that already won instead of erroring.
- Card-transfer top-ups (`TopUpRequest`) only ever credit a wallet through
  `topupService.verifyTopUpRequest()`, which requires an authenticated admin action. There is no
  code path that credits a wallet from a user-submitted claim alone.
- Admin balance adjustments (`POST /admin/users/:id/wallet/adjust`) always go through the same
  `applyLedgerEntry()`, always require a `reason`, and are always audit-logged
  (`writeAuditLog`) — there is no endpoint that writes `wallets.balance_minor` directly.

## API surface

```
GET    /health                              liveness, never touches the DB
GET    /ready                                readiness, 503 if DB unreachable

POST   /api/v1/auth/register|login|refresh|logout
POST   /api/v1/auth/google                   real Google ID token verification, see below
GET    /api/v1/auth/me
GET    /api/v1/auth/sessions                  auth required — active device/session list
DELETE /api/v1/auth/sessions/:id              auth required — revoke one session
POST   /api/v1/auth/logout-all                auth required — "log out everywhere"
POST   /api/v1/auth/account/delete-request    auth required — soft-delete; blocked if wallet balance > 0

GET    /api/v1/games
GET    /api/v1/games/:id
GET    /api/v1/games/:id/products
GET    /api/v1/promotions

POST   /api/v1/orders                        auth required
GET    /api/v1/orders
GET    /api/v1/orders/:id

POST   /api/v1/payments                      auth required
POST   /api/v1/payments/wallet                auth required — pay from UZDONATE wallet balance
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/dev-simulate      dev/test only

GET    /api/v1/saved-games                   auth required — "My Games" for Quick Buy
PUT    /api/v1/saved-games/:gameId           auth required — {playerId, serverId?}
DELETE /api/v1/saved-games/:gameId           auth required

GET    /api/v1/wallet                         auth required — balance
GET    /api/v1/wallet/transactions            auth required — ledger history

GET    /api/v1/topups/receiving-methods       active admin-configured receiving cards
POST   /api/v1/topups                         auth required — submit a top-up request
GET    /api/v1/topups                         auth required — my top-up requests
GET    /api/v1/topups/:id                     auth required

GET    /api/v1/notifications                  auth required
POST   /api/v1/notifications/:id/read         auth required
POST   /api/v1/notifications/read-all         auth required

POST   /api/v1/admin/auth/login|refresh|logout
GET    /api/v1/admin/auth/me                  admin auth required
GET    /api/v1/admin/orders(?status=&limit=)
GET    /api/v1/admin/orders/:id
POST   /api/v1/admin/orders/:id/retry-fulfillment   SUPER_ADMIN/ADMIN/OPERATIONS only
POST   /api/v1/admin/orders/:id/refund              SUPER_ADMIN/ADMIN/FINANCE only — refunds to wallet
GET    /api/v1/admin/users(?search=&limit=)
GET    /api/v1/admin/users/:id                 profile + wallet + recent orders/transactions/sessions
GET    /api/v1/admin/users/:id/wallet
GET    /api/v1/admin/users/:id/wallet/transactions
POST   /api/v1/admin/users/:id/wallet/adjust   SUPER_ADMIN/ADMIN/FINANCE only — ledger-only, reason required
GET    /api/v1/admin/topups(?status=&limit=)
POST   /api/v1/admin/topups/:id/verify         credits the wallet — the only path that does
POST   /api/v1/admin/topups/:id/reject         requires rejectionReason
GET    /api/v1/admin/receiving-methods
POST   /api/v1/admin/receiving-methods         SUPER_ADMIN/ADMIN only
PATCH  /api/v1/admin/receiving-methods/:id     SUPER_ADMIN/ADMIN only
GET    /api/v1/admin/products(?gameId=)
PATCH  /api/v1/admin/products/:id             {isActive?, amountMinor?} — elevated roles only
GET    /api/v1/admin/providers
GET    /api/v1/admin/payments/:id
GET    /api/v1/admin/stats
GET    /api/v1/admin/admins                    SUPER_ADMIN only
POST   /api/v1/admin/admins                    SUPER_ADMIN only — create an admin
PATCH  /api/v1/admin/admins/:id                SUPER_ADMIN only — {isActive?, role?}; can't deactivate self
GET    /api/v1/admin/audit-logs(?entityType=&limit=)   SUPER_ADMIN/ADMIN only
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

Configured for this project (`uzdonate` GCP project). `GOOGLE_CLIENT_ID` in `backend/.env` holds
the **Web application** OAuth client ID (`223785346997-vphv...`), which doubles as the Flutter
side's `GOOGLE_SERVER_CLIENT_ID`. A second, **Android**-type client (`uz.uzdonate.app`,
debug SHA-1 `3B:8B:0E:8B:FE:0B:CA:DB:8E:9B:1C:A9:B4:82:12:09:2B:B8:FC:0E` and release SHA-1) exists in the same
project so the native Android sign-in flow can hand back a verifiable token. The project's OAuth
consent screen is still in **Testing** publishing status, so only accounts added under Audience →
Test users can complete sign-in — add any new tester's Google account there before they try it.

To set this up from scratch on a new machine/project:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   OAuth 2.0 Client ID of type **Web application** (used as the `serverClientId` on the Flutter
   side — this is what lets the backend verify tokens as intended for *this* app). Copy its
   Client ID.
2. Create a second OAuth 2.0 Client ID of type **Android**, with this app's package name
   (`uz.uzdonate.app`) and the SHA-1 fingerprint of the signing key (for local debug
   testing: `cd mobile/android && ./gradlew signingReport`, use the `debug` variant's SHA1;
   for production: use `upload-keystore.jks` or Google Play App Signing SHA-1).
3. Set `GOOGLE_CLIENT_ID` in `backend/.env` to the **Web** client ID from step 1.
4. Run the Flutter app with `--dart-define=GOOGLE_SERVER_CLIENT_ID=<same Web client ID>`.
5. Under Audience → Test users, add every Google account that needs to sign in while the app
   is unverified/in Testing status — sign-in fails silently past the account picker otherwise.

Both the Web and Android client IDs must exist in the same GCP project for Android's native
Google Sign-In flow to hand back a token this backend can verify.

## Email setup

Configured on this machine via Gmail SMTP (an app password, not the account password — see
[Google's app passwords page](https://myaccount.google.com/apppasswords), requires 2-Step
Verification enabled first). `sendEmail()` in `src/lib/mailer.ts` sends the verification-code
email built by `src/lib/email-templates.ts` (branded HTML + plain-text fallback).

Without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` set, `sendEmail()` logs the email content at info
level instead of sending — the registration/verify-email flow still works end-to-end in dev,
you just read the 6-digit code out of the backend console rather than an inbox.

To use a different provider (Brevo, Resend's SMTP relay, your own mail server, ...), just point
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` at it — no code changes needed, any standard
SMTP account works. Gmail's free tier caps around ~500 sends/day, fine for dev and small-scale
production but worth moving off before real growth.

## Digiflazz top-up setup (primary provider)

Not configured yet — `src/providers/digiflazz/digiflazz-topup-provider.ts` implements the
`TopupProviderAdapter` interface (same contract `MockTopupProvider` uses). Unlike the Apigames
adapter below, its endpoints, request/response fields, and signature formula
(`md5(username + apiKey + suffix)`) are taken directly from Digiflazz's public technical
documentation (developer.digiflazz.com/api/buyer/...) — real, not guessed — though still
unverified against an actual account/live order, since that requires credentials that can't be
created on the operator's behalf.

Why Digiflazz over Apigames/UniPin Direct/Codashop Distribution: it's a genuine multi-seller
marketplace — several sellers compete on the same product, and Digiflazz's own price-list API
returns "the cheapest price or best commission from registered sellers" — rather than one
aggregator's fixed margin. Onboarding is self-service (no business-development approval
process), a better fit before real order volume justifies a direct publisher contract.

To finish this:

1. Register a buyer account at [digiflazz.com](https://digiflazz.com) and top up the deposit
   balance that funds transactions.
2. **Whitelist this server's outbound IP** in the Digiflazz buyer dashboard — every API call is
   rejected until this is done (their docs: "Silahkan whitelist IP ... di sistem Anda").
3. Set `DIGIFLAZZ_USERNAME` and `DIGIFLAZZ_API_KEY` (their "Production Key") in `backend/.env` —
   the provider registers itself in `src/providers/registry.ts` once both are present, same
   "wired but inert without credentials" pattern as Payme/Click.
4. Call the price-list endpoint (`POST /v1/price-list`, `cmd: "prepaid"`) to get real
   `buyer_sku_code`s for the games in this catalog, then in the admin panel map each `Product`
   to its code via `ProviderProduct` (mirrors how `DEV_MOCK_TOPUP` products are already mapped)
   and flip the `DIGIFLAZZ` provider row's `isActive` to `true`.

## Apigames top-up setup (secondary/fallback)

Not configured yet — `src/providers/apigames/apigames-topup-provider.ts` implements the same
`TopupProviderAdapter` interface, kept as a second option (e.g. for games Digiflazz doesn't
carry). Its request/response field mapping is a **placeholder**, not a verified integration:
their public API reference (docs.apigames.id) is a JS-rendered Postman page that couldn't be
fetched and read programmatically, so the endpoint paths and signature construction follow the
common convention for this class of Indonesian H2H top-up API, unconfirmed against the real
docs.

To finish this:

1. Register at [member.apigames.id](https://member.apigames.id/register) (self-service, no
   business-verification step) and top up the wallet balance that funds transactions.
2. Open the account's own API documentation from the member area (or share it with the AI
   assistant) to confirm/correct the endpoint paths, auth signature formula, and field names in
   `apigames-topup-provider.ts` against what's actually there — right now those are educated
   guesses, not verified.
3. Set `APIGAMES_USERNAME` and `APIGAMES_API_KEY` in `backend/.env`.
4. In the admin panel, map each `Product` to its real Apigames SKU code via `ProviderProduct`
   and flip the `APIGAMES` provider row's `isActive` to `true`.

## FazerCards top-up setup (cheapest checked so far — MLBB, PUBG Mobile, Free Fire)

**Status: configured and wired, but the reseller subscription is currently inactive.**
`FAZERCARDS_API_KEY` is set in `backend/.env`, the `FAZERCARDS` provider row is active, and it's
the priority-0 (preferred) supplier for real `ProviderProduct` mappings across MLBB (323
denominations), PUBG Mobile (all 6 UC packages), and Free Fire (7 regions). A live call to
`GET /topups/offers` on 2026-09-05 returned `403 {"code":"subscription_inactive"}` — the reseller
account itself needs renewing/funding at [reseller.fazercards.com](https://reseller.fazercards.com)
(USDT deposit) before any real order through it will actually succeed. Until that's done, every
order on these three games silently falls through to the `DEV_MOCK_TOPUP` fallback mapping
(priority 1) instead — check this before assuming a real customer order actually delivered.

`src/providers/fazercards/fazercards-topup-provider.ts` implements the same `TopupProviderAdapter`
interface, built from FazerCards' own published REST v2 docs (reseller.fazercards.com/en/docs —
real endpoint paths, `X-API-Key` auth, and request/response shapes, not guessed), but still
unverified against a live *order* (as opposed to the price-list call above), same caveat as the
other two adapters.

Why it's worth adding alongside Digiflazz/Apigames: checking a matching Mobile Legends
denomination against MRCODA's consumer storefront put FazerCards' listed wholesale price roughly
30-35% cheaper per diamond, and — unlike Digiflazz/Apigames, which only take an Indonesian
bank/e-wallet deposit — FazerCards' balance can be funded with USDT (TRC20/BEP20/TON/Aptos),
which is actually reachable from Uzbekistan. This is the first of a planned multi-provider
lineup (one or two vetted suppliers per game, picking whichever is genuinely cheapest) rather
than a wholesale replacement for Digiflazz.

Steps 1-4 below (account, API key, endpoint verification, product-code mapping) are already done.
**The only remaining step is renewing/funding the reseller subscription** at
[reseller.fazercards.com](https://reseller.fazercards.com) (USDT deposit) — do that, then re-check
with `curl -H "X-API-Key: $FAZERCARDS_API_KEY" https://api.fzr.cards/api/v2/topups/offers` to
confirm it no longer returns `subscription_inactive` before trusting these three games' orders to
actually deliver.

Original setup steps, kept for reference / re-doing this for a new account:

1. Register a reseller account at [reseller.fazercards.com](https://reseller.fazercards.com) and
   fund the balance (USDT deposit).
2. Create an API key from the reseller hub (Profile) and set `FAZERCARDS_API_KEY` in
   `backend/.env` — the provider registers itself in `src/providers/registry.ts` once present.
3. Open the API Cookbook / OpenAPI schema from the reseller hub (or share it with the AI
   assistant) to confirm/correct the endpoint paths and `fields` payload shape in
   `fazercards-topup-provider.ts` — the `fields: { player_id }` mapping is a best guess from the
   docs excerpt available, not confirmed per-game.
4. Note `providerProductCode` here is `"<category_id>:<offer_id>"` (both are needed to place an
   order) — encode it that way when mapping each `Product` to its `ProviderProduct` row, then
   flip the `FAZERCARDS` provider row's `isActive` to `true`.

## ReSellCodes top-up setup

ReSellCodes API v1 is wired as an optional server-side provider. Configure `RSC_API_KEY` only
as a backend/Render secret, and set `RSC_USD_UZS_RATE` to the effective UZS paid per USD when
funding the supplier wallet (including the actual exchange spread; do not use a guessed rate).
The admin Providers page has a separate **ReSellCodes narxlarini tekshirish** action. It only
reads the account-specific top-up catalog and stores exact supported SKU matches as disabled
provider mappings. Review product, game region, required account fields, and the converted cost
before enabling the provider or any individual mapping. This action never places an order.

Do not use the RSC supplier for a paid order until its catalog is synced and the matching
disabled mappings are reviewed. Provider order creation charges the RSC balance immediately;
there is no live-order smoke test in this setup flow. The adapter treats ambiguous network
results as pending to avoid an accidental second purchase.

## Card-transfer auto top-up setup

This is the "choose HUMO or UZCARD, enter an amount, get assigned one card, transfer that exact
amount, balance appears automatically" flow. Bankomat payments deliberately remain under manual
admin review.

How it works:

1. `POST /topups/reserve` (`reserveTopUpRequest` in `src/modules/topup/topup.service.ts`) picks
   one active `ReceivingMethod` that has no other still-live reservation on it right now, and
   creates a `TopUpRequest` with `expiresAt` 20 minutes out (`RESERVATION_TTL_MS`). Because
   exactly one request can hold a given card at a time, the *amount alone* is enough to identify
   which request a transfer belongs to — the user's stated amount is never rounded or modified.
2. The user transfers that exact amount to that exact card, using their own banking app.
3. A trusted transaction feed sends a unique transaction ID, card hint, and amount to
   `/api/v1/payments/webhooks/card-transaction`. The included **Telegram userbot**
   (`scripts/humo-listener.ts` — not built with the Bot API, since a bot
   can't read another bot's DMs to a user account; uses a real personal Telegram login via
   [GramJS](https://gram.js.org/)) sits in the background watching for new messages from the
   official `@HUMOcardbot`, which already sends a notification to its owner for every incoming
   transfer on cards registered with it. It parses the card hint + amount out of each message and
   forwards a normalized transaction. The legacy `/webhooks/humo-transaction` route is retained
   for existing listener deployments.
4. `autoVerifyFromCardTransaction` in `topup.service.ts` matches that card+amount against
   still-live `PENDING` reservations. Exactly one match → wallet credited immediately, no admin
   involved. Zero or more than one match → nothing happens automatically and an admin gets a
   Telegram alert to review manually (the request just sits there until it expires or an admin
   verifies it by hand, same as a regular top-up request).

**Deployment status is configuration-dependent.** Automatic HUMO/UZCARD options are shown only
when a webhook secret and a real, network-classified receiving card are configured. Placeholder
cards are never exposed as live payment rails. Bankomat remains available as a manual-review
channel when a real receiving card exists.

The listener itself runs as its own `humo-listener` service in `docker-compose.yml`
(`restart: unless-stopped`, same as `backend`) — **not** a manually-opened terminal running
`npm run humo:listener` anymore. That mattered: nothing was supervising the old setup, so any
crash, reboot, or network blip silently reverted every card-transfer top-up to manual-only review
with no alert that auto-verify had stopped. The listener's own event handler is also now wrapped
in try/catch so one malformed/unexpected message can't take the whole process down.

To set this up again from scratch (e.g. a new deployment, or rotating the Telegram session):

1. Set `CARD_TRANSACTION_WEBHOOK_SECRET` in `backend/.env` (`HUMO_WEBHOOK_SECRET` remains a legacy
   fallback) — without it the webhook route 404s and automatic top-ups
   fall back to manual admin review, same "wired but inert without credentials" pattern as every
   other provider here.
2. Add each real receiving card via the admin panel (full PAN, holder, bank, and HUMO/UZCARD
   network). If using the included listener, register supported cards with its notification source.
3. Get `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` from [my.telegram.org](https://my.telegram.org) →
   "API development tools", logged in as the account registered with `@HUMOcardbot`.
4. Run `npm run humo:listener` (from `backend/`) directly on the host once, interactively — first
   run has no `TELEGRAM_SESSION` yet, so GramJS prompts for the phone number, the login code
   Telegram texts you, and the 2FA password if set. This has to be done by the account owner in
   person; it can't be scripted or delegated. It prints a session string at the end.
5. Save that string as `TELEGRAM_SESSION` in `backend/.env`, then bring up the supervised
   container instead: `docker compose up -d --build humo-listener`. Check
   `docker logs donate_app_humo_listener` for `connected as <username>, watching messages from
   @HUMOcardbot` to confirm it's live.

## Environment

See `.env.example` for the full list. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `ADMIN_JWT_ACCESS_SECRET` (all three secrets must be ≥32 chars — the
app refuses to boot otherwise — and must all be *different* from each other). Optional:
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID` (admin alerts silently no-op without them),
`GOOGLE_CLIENT_ID` (Google Sign-In responds `503` without it), `SMTP_HOST`/`SMTP_USER`/
`SMTP_PASSWORD` (verification emails log to console instead of sending without them),
`DIGIFLAZZ_USERNAME`/`DIGIFLAZZ_API_KEY` and/or `APIGAMES_USERNAME`/`APIGAMES_API_KEY` (top-up
orders have no real provider to route to without at least one — see "Digiflazz top-up setup"),
and `CARD_TRANSACTION_WEBHOOK_SECRET` (automatic card-transfer top-ups remain unavailable without it —
see "Card-transfer auto top-up setup").

## Telegram admin notifications

`src/lib/telegram.ts`'s `notifyAdmins()` posts to `https://api.telegram.org/bot<token>/sendMessage`
via native `fetch`, fire-and-forget (never awaited by the request it's reporting on, errors are
only logged). Wired into: new top-up requests, top-up verified, new orders, payment
success/failure, and refunds. To enable: create a bot via
[@BotFather](https://t.me/BotFather), add it to the admin group/channel, send one message there,
then call `https://api.telegram.org/bot<token>/getUpdates` to find the numeric chat ID. Set both
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` in `backend/.env`.

## A note on error-handler registration order

`app.setErrorHandler`/`app.setNotFoundHandler` are registered **before** any routes/plugins
in `app.ts`. Fastify resolves each encapsulated context's error handler at the time its
routes are defined, not lazily per request — registering the custom handler after the nested
`/api/v1` route tree left those routes silently falling back to Fastify's default (differently
shaped) error output. Caught by `test/admin-auth.test.ts`. If you add new top-level
plugin/route registrations, keep the error handlers first.
