#!/bin/bash
set -euo pipefail
release_id=${1:?Release directory name required}
[[ "$release_id" =~ ^[0-9]{8}-[a-f0-9]{7,40}$ ]] || exit 2
release="/opt/uzdonate/releases/$release_id"
[[ "$(realpath -e "$release")" == "$release" && -f "$release/backend/dist/server.js" ]] || exit 2
exec 9>/var/lib/uzdonate-production/deploy.lock
flock -n 9 || { echo 'Another production deployment is active'; exit 3; }

systemctl start uzdonate-backup.service
[[ "$(systemctl show uzdonate-backup.service -p Result --value)" == success ]]
systemd-run --quiet --wait --pipe --collect --unit=uzdonate-release-migration \
  -p "WorkingDirectory=$release/backend" \
  -p LoadCredentialEncrypted=environment:/etc/credstore.encrypted/uzdonate-production \
  /opt/uzdonate/node/bin/node "$release/deploy/contabo/run-production.mjs" --migrate
systemd-run --quiet --wait --pipe --collect --unit=uzdonate-release-preflight \
  -p User=uzdonate -p "WorkingDirectory=$release/backend" \
  -p LoadCredentialEncrypted=environment:/etc/credstore.encrypted/uzdonate-production \
  /opt/uzdonate/node/bin/node "$release/deploy/contabo/run-production.mjs" --check

previous=$(readlink -f /opt/uzdonate/production)
ln -s "$release" /opt/uzdonate/.production-next
mv -Tf /opt/uzdonate/.production-next /opt/uzdonate/production
systemctl restart uzdonate-production
for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:4003/ready >/dev/null; then
    printf '%s\n' "$release_id" > "$release/deployment-commit"
    printf 'Production release %s is ready\n' "$release_id"
    exit 0
  fi
  sleep 2
done

ln -s "$previous" /opt/uzdonate/.production-rollback
mv -Tf /opt/uzdonate/.production-rollback /opt/uzdonate/production
systemctl restart uzdonate-production
echo 'Readiness failed; previous release restored'
exit 1
