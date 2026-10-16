#!/usr/bin/env python3
"""Switch only the UZDONATE TLS host from Render to the prepared local service."""
from datetime import datetime, timezone
from pathlib import Path
import subprocess

target = Path('/etc/nginx/sites-available/uzdonate.uz')
source = Path('/opt/uzdonate/production/deploy/contabo/nginx-local-proxy.conf')
snippet = Path('/etc/nginx/snippets/uzdonate-local-proxy.conf')
previous = target.read_text()
old = 'include /etc/nginx/snippets/uzdonate-render-proxy.conf;'
new = 'include /etc/nginx/snippets/uzdonate-local-proxy.conf;'
if old not in previous or previous.count(old) != 1:
    raise SystemExit('Expected existing Render upstream exactly once')
subprocess.run(['curl', '--fail', '--silent', 'http://127.0.0.1:4003/ready'], check=True, stdout=subprocess.DEVNULL)
backup = Path('/var/backups/uzdonate') / ('nginx-before-contabo-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S') + '.conf')
backup.write_text(previous)
backup.chmod(0o600)
snippet.write_text(source.read_text())
snippet.chmod(0o644)
temporary = target.with_suffix('.new')
temporary.write_text(previous.replace(old, new))
temporary.chmod(0o644)
temporary.replace(target)
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except BaseException:
    target.write_text(previous)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print('UZDONATE now proxies the local Contabo application; previous host configuration saved')
