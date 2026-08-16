# UZDONATE — Admin panel

React + Vite + TypeScript. Talks directly to the same backend admin API used by any other
admin client — no server component of its own, no separate database access.

## Running

```bash
npm install
cp .env.example .env   # VITE_API_BASE_URL, defaults to http://localhost:4000/api/v1
npm run dev              # http://localhost:3000
npm run build             # tsc -b && vite build -> dist/
```

`backend/.env`'s `CORS_ORIGIN` already defaults to `http://localhost:3000` to match this dev
server's port.

## Scope (MVP)

Dashboard (order/top-up/revenue stats), Users (search, wallet detail + admin-only ledger
adjustment), Orders (list/detail/refund/retry-fulfillment), Top-up requests (verify/reject
queue), Receiving methods (admin-configured card-transfer top-up destinations), Products
(price/active toggle), Providers (read-only health/status), Audit logs (filterable by entity
type), Admins (SUPER_ADMIN-only: create admins, change role, activate/deactivate — hidden from
the nav for non-SUPER_ADMIN roles; the backend enforces the same restriction independently, so
hiding the link is a UX nicety, not the actual access control).

Not built in this pass, left for a follow-up: Telegram config UI (env-based today), and
Analytics beyond the dashboard's basic breakdowns.

## Auth

Signs in against `POST /admin/auth/login` (same admin accounts as the backend's seeded/created
`AdminUser` rows) and stores the access/refresh token pair in `localStorage`
(`src/api/tokenStore.ts`). This is a pragmatic choice for an internal tool — there is no browser
equivalent of the mobile app's Keystore-backed secure storage. For a production deployment,
put this panel behind a VPN or IP allowlist at the reverse-proxy layer in addition to the
existing admin auth, and keep `ADMIN_JWT_ACCESS_TTL` short.

## Money

All amounts from the API are integer minor units (e.g. UZS tiyin); `src/lib/money.ts` divides
by 100 for display. Never format money client-side from a float — the backend never sends one.
