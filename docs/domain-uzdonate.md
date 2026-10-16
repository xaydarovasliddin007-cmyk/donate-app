# UZDONATE domain operations

As of 16 October 2026, `uzdonate.uz` serves the production application directly
from Contabo `169.58.93.88`. Render is suspended and automatic deployments are
Off. The previous Render proxy templates remain in the repository only as
historical recovery references. See [Contabo operations](contabo-deployment.md)
for the current service, encrypted configuration, database and backup details.

## DNS and HTTPS

- Apex A record: `169.58.93.88`.
- www CNAME: `uzdonate.uz.`.
- Both HTTP names and HTTPS www redirect to `https://uzdonate.uz` with the path
  and query preserved.
- The Let's Encrypt certificate covers both names and expires 13 January 2027.
- `certbot.timer` and the scoped nginx renewal hook remain enabled.
- No additional DNS purchase or record change was needed for the migration.

## Local upstream

The enabled virtual host is `/etc/nginx/sites-available/uzdonate.uz`, linked from
`sites-enabled`. Its main HTTPS location includes
`/etc/nginx/snippets/uzdonate-local-proxy.conf`, whose upstream is
`http://127.0.0.1:4003`. Requests no longer reach Render. Public responses include
`X-UZDONATE-Hosting: contabo` for operational verification.

The proxy replaces forwarded client identity headers, keeps the original host
and URI, disables caching and permits 10 MB bodies for base64 receipt uploads.
`/privacy.html`, `/privacy`, `/terms.html` and `/terms` retain their internal
rewrites to the webapp legal pages. All TLS settings and unrelated virtual hosts
are preserved.

`deploy/contabo/cutover-local.py` performed the scoped change after checking the
local readiness endpoint, saving the previous virtual host under
`/var/backups/uzdonate`, and validating nginx. It restores the previous config if
validation or reload fails. Do not run this one-time script again on an already
migrated site; normal updates retain the current local upstream.

## Integrations

The app enforces `PUBLIC_APP_URL=https://uzdonate.uz` and allows this CORS origin.
Both Telegram webhooks use the same domain. Android 0.2.2 uses
`https://uzdonate.uz/api/v1`. The Google OAuth web origin remains valid because
the public domain did not change. The old Render OAuth origin can remain inert;
it does not require running or paying for a Render service.

## Verification and recovery

Run `nginx -t` before any reload. Check the public health, readiness, app config,
catalog, frontend and legal routes; verify the hosting header and HTTPS redirects.
`uzdonate-production` is enabled, while the old read-only `uzdonate.service` is
disabled. Existing UzPost services and their nginx hosts must remain intact.

For application recovery, restore a known-good Contabo release and restart the
production service. Do not merely restore the old Render proxy while Render is
suspended. A deliberate cross-host rollback would require stopping Contabo's
production workers before resuming Render to avoid duplicate Telegram sessions.
