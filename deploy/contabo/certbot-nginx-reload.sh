#!/bin/sh
# Certbot deploy hook: only reload nginx after a renewed certificate exists
# and the complete configuration passes its syntax check.
set -eu
case "${RENEWED_LINEAGE:-}" in
    /etc/letsencrypt/live/uzdonate.uz) ;;
    *) exit 0 ;;
esac
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
