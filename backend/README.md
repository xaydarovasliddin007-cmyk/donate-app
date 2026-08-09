# Donate App — Backend

REST API. Node.js + TypeScript + Fastify + Prisma + PostgreSQL. Modular monolith.

## Architecture

```
src/
  config/env.ts        zod-validated environment config (fails fast on boot if invalid)
  app.ts                Fastify app builder: plugins, routes, error handling
  server.ts             entrypoint: listen + graceful shutdown
  plugins/prisma.ts      registers a lazily-connecting PrismaClient on the app instance
  lib/
    logger.ts            pino logger (redacts secrets/tokens in log output)
    errors.ts            AppError hierarchy (ValidationError, UnauthorizedError, ...)
    validate.ts           zod preHandler for request bodies
    duration.ts            tiny "15m"/"30d" duration parser
  middleware/authenticate.ts   JWT access-token verification preHandler
  modules/
    health/                /health (liveness) and /ready (readiness) routes
    auth/                    register/login/refresh/logout/me
prisma/
  schema.prisma           Phase 1 schema: User, RefreshToken
  migrations/               SQL migrations (generated via `prisma migrate diff`, since no
                              local Postgres was available to run `prisma migrate dev`
                              against — verify with `prisma migrate deploy` once a DB is up)
```

Each module owns its routes/service/schemas; modules talk to the database through
`app.prisma` directly for now (no repository layer yet — would be premature at this size).

## Auth design

- **Access tokens**: short-lived JWTs (`JWT_ACCESS_TTL`, default 15m), signed with
  `JWT_ACCESS_SECRET`.
- **Refresh tokens**: opaque random strings, only their SHA-256 hash is stored in
  `refresh_tokens`. Rotated on every use; reuse of an already-rotated (revoked) token
  revokes the entire session family for that user (theft detection).
- **Passwords**: argon2id (OWASP-recommended parameters).

## Running

```bash
npm install
npm run prisma:generate
npm run prisma:deploy     # requires a reachable PostgreSQL — see ../docker-compose.yml
npm run dev                # http://localhost:4000
```

## Commands

```bash
npm run dev          # tsx watch
npm run build         # tsc -> dist/
npm run typecheck      # tsc --noEmit
npm run lint            # eslint
npm test                 # vitest
npm run prisma:studio     # DB browser GUI
```

## Environment

See `.env.example` for the full list. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` (both must be ≥32 chars — the app refuses to boot otherwise).
