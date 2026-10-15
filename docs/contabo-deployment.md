# UZDONATE Contabo staging

Status recorded on 15 October 2026. This application deployment is private read-only staging; Render remains the production application. The same VPS now serves the purchased `uzdonate.uz` domain through a separate nginx HTTPS edge with a valid certificate for the apex and www names. See [domain operations](domain-uzdonate.md) for the live public edge; it proxies Render without promoting this staging service.

## Prepared release

The local release command `node scripts/build-release.mjs` completed successfully. It built the admin panel, customer superapp, and backend, then copied frontend assets into `backend/public`.

- Admin JavaScript: `index-BqWfjjdE.js`
- Admin CSS: `index-BRoZ7cbL.css`
- Superapp JavaScript: `index-DGAJeTNO.js`
- Superapp CSS: `index-CU0w4NsB.css`

The compiled backend, public assets, Prisma files, package manifest, and lockfile were uploaded. Local `.env` files were not uploaded. No database migrations or seeds were run for this deployment.

## Runtime and isolation

The service template is `deploy/contabo/uzdonate.service`. It uses a dedicated `uzdonate` system user and a separate Node.js 24 runtime.

- Application directory: `/opt/uzdonate/current/backend`
- Node executable: `/opt/uzdonate/node/bin/node`
- Runtime environment: `/etc/uzdonate/environment`
- Backend listener: `127.0.0.1:4002`

The staging environment uses the existing Neon database connection with PostgreSQL's `default_transaction_read_only=on` startup option. Default and transaction read-only settings were checked locally through Prisma, and the setting was also verified on the VPS. This protects the existing database from normal staging writes; a dedicated database role with read-only grants would provide stronger separation if this staging setup is retained.

Real provider credentials, Telegram bot/session credentials, and SMTP credentials are omitted. This prevents staging from claiming the live Telegram webhook/session or sending real provider purchases and emails.

The service restarts on failure, has a private temporary directory, restricts filesystem access, and caps memory at 768 MB. `NODE_ENV=production`, distinct random JWT signing secrets, the listener address, and port must be supplied through its environment file. Do not put secrets in this document or the repository.

## Private preview

The preview uses an SSH tunnel from local port 4100 to the VPS loopback listener on port 4002. The tunnel was started on the user's computer; if it closes, reopen it with:

```text
ssh -N -L 127.0.0.1:4100:127.0.0.1:4002 <ssh-user>@<vps-host>
```

Preview addresses while the tunnel is running:

- Customer app: `http://127.0.0.1:4100/webapp/`
- Admin panel: `http://127.0.0.1:4100/admin/`
- Liveness: `http://127.0.0.1:4100/health`
- Database reachability: `http://127.0.0.1:4100/ready`

These addresses are local previews of the read-only staging application. The separate public domain edge proxies Render and does not send production requests to this staging listener.

## Deployment verification

Release `20261014-125352` is installed at `/opt/uzdonate/releases/20261014-125352`; `current` points to that release. It contains the 0.2.1 cinematic storefront motion update. The `uzdonate.service` unit is enabled and running. Native password hashing and the Linux Prisma client were checked on the VPS during initial setup; the unchanged Linux dependencies were reused for this update.

The VPS returned HTTP 200 for `/health`, `/ready`, `/webapp/`, `/admin/`, `/api/v1/app/config`, `/api/v1/games`, and both release JavaScript bundles. The catalog returned 17 games. Google client configuration is present and Telegram integration is disabled in staging. The listener was confirmed bound only to `127.0.0.1:4002`; existing nginx and both UzPost services remained active.

## Expected limitations

Read-only staging can serve static pages and query the catalog. Guest authentication, login/refresh, wallet changes, purchases, top-ups, and admin mutations require database writes and will fail in this mode. The superapp automatically requests guest authentication on launch, so an account error is expected even when the catalog and page assets load correctly.

`/ready` checks `SELECT 1`; success confirms database reachability, not write permission or working payment/fulfillment flows. The backend also runs fulfillment reconciliation every 30 seconds. In staging it lacks real provider credentials and cannot persist updates to the read-only database.

## Remaining production work

1. Keep the staged service healthy and use an isolated database for any tests that need writes.
2. If moving the production application from Render to this VPS later, change the domain edge upstream only after the remaining production environment and integration handover work is complete. Keep the Node listener private and configure the final `PUBLIC_APP_URL` and allowed origins.
3. Verify Google web origins and Android signing configuration against the final URLs and release build.
4. Before enabling writes, back up the database and review Prisma migration status. Use an isolated database for full staging tests while Render continues serving production.
5. Configure the real provider, card-transfer listener, Telegram bots, and SMTP through the protected server environment. Check provider IP allowlists where required.
6. Plan the handover so only one server owns each Telegram user session and webhook. Activating the same user session on Render and Contabo simultaneously can invalidate it.
7. Run the real login, funding, fulfillment, order-status, and recovery checks after the final environment is configured. Confirm backups, monitoring, and a rollback path before sending production traffic to Contabo.

A functioning static preview does not complete these production steps.
