# UZDONATE on Contabo

Production migrated on 16 October 2026 at the user's request. The public domain
now uses the application on Contabo `169.58.93.88` directly. Render is suspended,
its automatic deployments are Off, and its former URL returns 503. Do not resume
Render or run the same Telegram user session on two hosts.

## Runtime

- Production release: `/opt/uzdonate/releases/20261016-bc55a0c`.
- Production symlink: `/opt/uzdonate/production`.
- Application code: commit `bc55a0c`; frontend bundle hashes are unchanged.
- Service: `uzdonate-production.service`, enabled across reboots.
- Listener: `127.0.0.1:4003`; the Node port is not public.
- Runtime: `/opt/uzdonate/node/bin/node`, Node.js 24.
- Active mode: `/etc/systemd/system/uzdonate-production.service.d/active.conf`.
- The old `uzdonate.service` on port 4002 is stopped and disabled.
- Existing UzPost services and PostgreSQL 16 remain running.

The launcher initially uses standby mode, serving HTTP without starting bot
webhook registration, the Telegram user session, or fulfillment reconciliation.
After verifying the local service and switching nginx, Render was suspended.
Only then was the active production override installed and the service restarted.
Future deployment procedures must preserve that single-owner rule.

## Configuration and database

Production configuration was copied from the existing Render environment over
SSH directly into an encrypted systemd credential. No plaintext production
configuration was saved in the workspace or release archive. The persistent
credential is `/etc/credstore.encrypted/uzdonate-production`, root-only and bound
to this server's systemd host key. systemd exposes it to the service through its
private credential directory; never print or copy the decrypted content.

The customer/admin signing secrets and the existing Neon PostgreSQL connection
were preserved. Neon is an independent database service; the application no
longer needs Render. The migration preflight confirmed 33 applied migrations, normal write
permissions, 58 existing accounts and one existing order before browser checks.
No database seed, balance credit, purchase or rejection was performed.

`PUBLIC_APP_URL=https://uzdonate.uz`, `CORS_ORIGIN=https://uzdonate.uz` and loopback
port 4003 are enforced by the launcher. Android 0.2.2 already uses this domain.

## Backups

A consistent `pg_dump` archive was streamed through age encryption to
`/var/backups/uzdonate/production-2026-10-15T19-48-01.179Z.dump.age` before cutover.
It was decrypted into a pipe and checked with `pg_restore --list`: 204 archive
entries, 222892 encrypted bytes. No plaintext dump was stored. The actual dump
uses PostgreSQL client 18 to match Neon 18; the pre-existing local PostgreSQL 16
server was not replaced. Client installation follows the
[official PostgreSQL Ubuntu repository instructions](https://www.postgresql.org/download/linux/ubuntu/).

`uzdonate-backup.timer` runs a verified encrypted backup daily around 02:20 UTC.
Its service completed successfully after installation. Recovering an archive
requires the server's SSH host Ed25519 private key; protect this key and the
systemd host credential key in the operator's normal VPS recovery plan.

## Integration results

The main bot `@uzdonate1bot` and receipt bot `@uzdonateadminbot` both have HTTPS
webhooks at the domain, zero pending updates and no last webhook error. The
Contabo journal confirms the card transaction listener connected and both
webhooks were configured. The Google web client and popup/referrer headers are
unchanged. The Telegram amount-review update has now applied migration 34.

On 16 October 2026, the receipt recipient was corrected to the private Chat ID
provided by the owner after sending `/id` to `@uzdonateadminbot`. Telegram
`getChat` confirmed the private chat is accessible and is not the receipt bot.
Only `TOPUP_REVIEW_CHAT_ID` changed inside the encrypted credential; every other
setting was preserved. After restarting production, the saved recipient matched,
the webhook had zero pending updates, and both webhooks and the card listener
started successfully. The owner's screenshot confirms a real receipt reached the
bot. Durable admin receipt storage remains available independently of Telegram.

Receipt messages now offer `Boshqa summa`: enter the amount, give a reason, then
confirm the exact credit. Drafts are private-chat/message bound, expire after 15
minutes and commit with the ledger and audit. 274 isolated backend tests passed,
including duplicate, concurrent, cancelled, expired and audit-rollback cases. The
deployed code, draft table and webhook were checked with zero pending updates.
The owner's example receipt is already REJECTED and was not changed or credited.
The full corrected-amount flow still needs a human check on a new open receipt.

Admin login was verified in the live browser after the owner supplied the correct
existing credential. The account remained active and its password was not reset.
The unused local recovery form was stopped and its temporary server helper removed.

The following pre-existing provider issue remains separate from hosting:

- The configured ReSellCodes key returns HTTP 401 in a read-only catalog check;
  its currency conversion rate is also absent. A valid provider setup is needed
  before claiming real game fulfillment works. No real purchase was tested.

## Operations and checks

```sh
systemctl status uzdonate-production --no-pager
systemctl show uzdonate-production -p NRestarts
curl --fail http://127.0.0.1:4003/ready
curl --fail -I https://uzdonate.uz/webapp/
systemctl status uzdonate-backup.timer --no-pager
```

The domain's `/health`, `/ready`, `/webapp/`, `/admin/`, legal pages, app config
and catalog return HTTP 200 with `X-UZDONATE-Hosting: contabo`. Both frontend
bundles match the release. HTTP and www redirect to the HTTPS apex. The Google
popup headers on `/webapp/` remain `same-origin-allow-popups` and
`strict-origin-when-cross-origin`. Private receipt routes still require auth.

For a code update, create a new release, install locked Linux dependencies,
generate Prisma, and verify the build before switching the production symlink.
Check migration status and take a verified encrypted backup before any schema
change. Preserve the encrypted credential, active mode override and nginx site.
Restart only `uzdonate-production`; never bring Render back during a normal
release. Keep previous releases for recovery and do not modify the UzPost apps.

`deploy/contabo/promote-release.sh <release-directory-name>` serializes a prepared
release, runs a verified encrypted backup, applies migrations, checks the candidate,
switches the symlink and restarts the one production service. If readiness fails,
it restores the prior release. The backup process completion race found during
this release was fixed and two consecutive backup/decryption checks succeeded.
