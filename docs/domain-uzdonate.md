# UZDONATE domain edge

## Operational status — 15 October 2026

The Billur authoritative zone has the correct apex A record `169.58.93.88` and
`www` CNAME `uzdonate.uz.` with TTL 300. Registry delegation is active, and Google
and Cloudflare public resolvers return both names correctly. The HTTPS edge is
live at `https://uzdonate.uz/webapp/` and proxies the existing Render production
application. Its Let's Encrypt certificate covers both names and expires on
13 January 2027 at 06:11:50 UTC. HTTP and HTTPS www requests redirect to the apex
HTTPS origin with path and query preserved.

The bounded completion worker succeeded on its first certificate attempt. Its
state is `complete`, its completion marker exists, and the temporary completion
timer disabled itself. The normal Certbot renewal timer remains active. Verified
domain routes `/health`, `/ready`, `/api/v1/app/config`, `/webapp/`, `/admin/`,
`/privacy.html` and `/terms.html` return 200. Both pre-existing nginx applications
still return 200 and their configurations are unchanged.
The scoped nginx renewal hook passed a direct execution check, and
`certbot renew --cert-name uzdonate.uz --dry-run --no-random-sleep-on-renew --quiet`
completed successfully. Normal scheduled renewal keeps its default timing.

After infrastructure completion, Render's `PUBLIC_APP_URL` was changed to
`https://uzdonate.uz`. `CORS_ORIGIN` now retains the Render origin and adds the
apex domain: `https://donate-app-5vhs.onrender.com,https://uzdonate.uz`.
The resulting Render deployment succeeded. The storefront bot `@uzdonate1bot`
now opens `https://uzdonate.uz/webapp/`, and its verified webhook is
`https://uzdonate.uz/api/v1/telegram/webhook` with zero pending updates.
Both HTTPS origins were saved in the existing Google web OAuth client's
authorized JavaScript origins. Google may take time to propagate that setting.
The existing Render URL remains available at
`https://donate-app-5vhs.onrender.com/webapp/`.

`uzdonate.uz` and `www.uzdonate.uz` use the existing Contabo server at
`169.58.93.88` as an HTTPS reverse proxy. Render remains the production
application at `https://donate-app-5vhs.onrender.com`, including its database
writes, provider connections, Telegram webhooks and bank notification listener.
The private Contabo service on `127.0.0.1:4002` remains read-only staging.

This arrangement gives the brand its domain without starting a second payment
worker or Telegram user session. Existing Android releases can keep using the
Render API URL, and GitHub auto deployments on Render also update the domain.

## DNS

- Apex `uzdonate.uz`: A record `169.58.93.88`.
- `www.uzdonate.uz`: CNAME `uzdonate.uz`.
- Do not publish an AAAA record unless the server's public IPv6 route has also
  been configured and verified.

BillurCOM's DNS manager appends the zone name to the host field. Use the apex
marker/empty host accepted by the form for the A record and `www` for the CNAME
host; entering the full domain in that field creates a duplicated name. The
CNAME target is the absolute name `uzdonate.uz.`. Verify the actual authoritative
answers after saving, rather than relying only on the table displayed by the UI.

A new registration also needs delegation at the `.uz` registry. If direct
queries to `ns1.uz` and the other `.uz` nameservers return NXDOMAIN, successful
Billur zone creation alone has not made the domain public yet. Wait for the
registry delegation before issuing the certificate; recursive DNS may retain
the previous NXDOMAIN until its negative cache expires.

## Server files

- `deploy/contabo/nginx-render-proxy.conf` is installed as
  `/etc/nginx/snippets/uzdonate-render-proxy.conf`.
- `deploy/contabo/nginx-uzdonate-http.conf` is the temporary HTTP bootstrap
  virtual host at `/etc/nginx/sites-available/uzdonate.uz`. It serves only ACME
  challenges; other paths return a maintenance response with status 503 and
  `Retry-After: 300` until HTTPS is enabled.
- After certificate issuance, replace that virtual host with
  `deploy/contabo/nginx-uzdonate-https.conf`.
- Enable only the new site through
  `/etc/nginx/sites-enabled/uzdonate.uz`.
- `deploy/contabo/certbot-nginx-reload.sh` is installed as an executable Certbot
  deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/uzdonate-nginx-reload`.

The proxy verifies Render's TLS certificate using the system CA store and sends
the correct Render hostname for both HTTP Host and TLS SNI. It replaces
client-supplied forwarding headers, passes the original host/protocol, permits
10 MB request bodies, and waits up to 120 seconds for a cold Render instance.
The Render hostname is resolved at runtime through the local system resolver
with a five-minute validity window, so Render IP changes do not require nginx
reloads. Omitting the URI component in `proxy_pass` preserves original escaped
paths and queries, while legal-page internal rewrites use their changed URI.
This follows the official nginx documentation for
[proxy_pass without a URI](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)
and [runtime DNS resolution](https://nginx.org/en/docs/http/ngx_http_core_module.html#resolver).
There is no proxy cache. Receipt upload and authenticated responses retain
application-defined behavior.
Render's HTTP/3 advertisement and HSTS header are hidden because this edge does
not advertise HTTP/3 or inherit a year-long policy for every subdomain.
The public legal paths `/privacy.html`, `/privacy`, `/terms.html` and `/terms`
serve the corresponding page from `/webapp/` through an internal rewrite.

## Certificate and renewal

After public DNS points both names to Contabo, issue the certificate using the
existing Certbot account and the shared webroot:

```sh
certbot certonly --non-interactive --webroot --webroot-path /var/www/letsencrypt \
  --cert-name uzdonate.uz -d uzdonate.uz -d www.uzdonate.uz
nginx -t
systemctl reload nginx
```

The final virtual host redirects HTTP and `www` requests to
`https://uzdonate.uz` while preserving path and query. HTTP ACME challenges stay
available for renewal. No HSTS preload is enabled. The existing `certbot.timer`
runs renewal; the deploy hook validates and gracefully reloads nginx after a
successful renewal. Other virtual hosts are kept intact.

## Bounded registration completion

For a registration awaiting `.uz` delegation, the optional
`uzdonate-domain-https.timer` runs the `complete-domain-https.py` oneshot worker
every five minutes. The service and both nginx templates are installed under
`/opt/uzdonate/domain-edge`; the units are installed under `/etc/systemd/system`.

The worker requires correct direct delegation answers from two `.uz` parents
and matching apex A / www CNAME answers on all four Billur authoritative servers
before requesting a certificate. It permits at most three ACME attempts,
separated by at least one hour, within a maximum 24-hour completion window.
Each invocation has a nine-minute monotonic work budget beneath systemd's
12-minute process timeout. Budget exhaustion leaves the timer active for a later
check; certificate issuance and atomic configuration changes reserve enough
time before starting. The persistent `deadline` field in `state.json` records
the 24-hour limit from the first activation.
Existing recursive NXDOMAIN caches do not trigger certificate attempts while
the parent delegation is missing.

Once a certificate with both DNS names exists, the worker atomically replaces
only the UZDONATE virtual host, validates nginx, and gracefully reloads it. A
rejected configuration is restored. It verifies local TLS, all public app and
legal routes, and public HTTPS reachability. Success writes
`/var/lib/uzdonate-domain/complete` and disables the completion timer. Expiry,
exhausted certificate attempts, or configuration errors also disable the timer
and require manual review. This worker does not modify application credentials,
Render settings, bot menus, the staging service, or unrelated nginx sites.

```sh
systemctl enable --now uzdonate-domain-https.timer
systemctl status uzdonate-domain-https.timer
cat /var/lib/uzdonate-domain/state.json
journalctl -u uzdonate-domain-https.service --no-pager
```

The state and ACME diagnostics are root-only. To cancel pending completion, run
`systemctl disable --now uzdonate-domain-https.timer` and stop the corresponding
service if it is running. The normal Certbot renewal timer remains enabled.

## Application settings

Keep the production secrets on Render. `PUBLIC_APP_URL` uses
`https://uzdonate.uz`; the comma-separated `CORS_ORIGIN` list includes the apex
and existing Render origin. The `www` hostname redirects to the apex before
loading the app, so it does not require a separate browser origin.
The Telegram shop menu uses the new mini app URL. The application configures
its webhook on startup using the origin of `PUBLIC_APP_URL`; the domain proxy
passes webhook requests to the same Render instance. The existing Google web
OAuth client authorizes both the new apex and the Render HTTPS origin.

## Checks and rollback

Run `nginx -t` before every reload. Check `/health`, `/ready`, `/webapp/`,
`/admin/` and `/api/v1/app/config` through the domain, plus the HTTP and `www`
redirects. Verify the TLS certificate covers both names and the pre-existing
nginx applications still respond. Auth or purchase smoke tests must not create
real purchases without a specific reason.

To remove the domain edge, unlink only
`/etc/nginx/sites-enabled/uzdonate.uz`, run `nginx -t` and gracefully reload nginx.
The original Render URL continues to work. If rolling back the application URL,
restore `PUBLIC_APP_URL`, CORS and the Telegram menu to their prior values too.
Do not stop Render or promote the private read-only staging service as part of
this rollback.
