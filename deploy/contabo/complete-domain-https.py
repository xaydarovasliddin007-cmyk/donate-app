#!/usr/bin/python3
"""Bounded, secret-free infrastructure completion for the purchased domain."""
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time

STATE_DIR = Path('/var/lib/uzdonate-domain')
STATE_FILE = STATE_DIR / 'state.json'
TIMER = 'uzdonate-domain-https.timer'
DOMAIN = 'uzdonate.uz'
WWW = 'www.uzdonate.uz'
ADDRESS = '169.58.93.88'
LIVE = Path('/etc/nginx/sites-available/uzdonate.uz')
TEMPLATES = Path('/opt/uzdonate/domain-edge')
CERT = Path('/etc/letsencrypt/live/uzdonate.uz/fullchain.pem')
KEY = Path('/etc/letsencrypt/live/uzdonate.uz/privkey.pem')
state = {}
PASS_DEADLINE = time.monotonic() + 540


class InvocationBudgetExpired(TimeoutError):
    pass


class CompletionDeadlineExpired(TimeoutError):
    pass


def log(message):
    print(time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), message, flush=True)


def save(status):
    state['status'] = status
    state['updatedAt'] = int(time.time())
    temporary = STATE_DIR / 'state.json.next'
    temporary.write_text(json.dumps(state, indent=2) + '\n')
    temporary.chmod(0o600)
    os.replace(temporary, STATE_FILE)


def reserve(seconds):
    if state.get('deadline', time.time() + 86400) - time.time() < seconds:
        raise CompletionDeadlineExpired('Completion deadline reached')
    if PASS_DEADLINE - time.monotonic() < seconds:
        raise InvocationBudgetExpired('Invocation budget reached')


def run(args, timeout=20):
    reserve(3)
    remaining = min(state.get('deadline', time.time() + 86400) - time.time(),
                    PASS_DEADLINE - time.monotonic()) - 2
    try:
        return subprocess.run(args, text=True, capture_output=True,
                              timeout=min(timeout, remaining), check=False)
    except subprocess.TimeoutExpired:
        reserve(3)
        # A temporary DNS/ACME timeout is a failed bounded attempt, not an
        # exception that disables all later checks.
        return subprocess.CompletedProcess(args, 124, '', 'Operation timed out.\n')


def stop(status, message, failed=False):
    save(status)
    subprocess.run(['systemctl', 'disable', '--now', TIMER],
                   capture_output=True, timeout=15, check=False)
    log(message)
    return 1 if failed else 0


def answer(server, name, kind):
    result = run(['dig', '+norecurse', '+tries=1', '+timeout=3',
                  '+noall', '+answer', '+authority', '@' + server, name, kind], 6)
    return [line.split() for line in result.stdout.splitlines()
            if line and not line.startswith(';')]


def dns_ready():
    expected = {f'ns{i}.billur.com.' for i in range(1, 5)}
    # Query the parent directly, avoiding recursive NXDOMAIN caches.
    for parent in ['ns1.uz', 'ns2.uz']:
        delegated = {row[4].lower() for row in answer(parent, DOMAIN, 'NS')
                     if len(row) >= 5 and row[3] == 'NS'}
        if delegated != expected:
            return False
    for server in sorted(expected):
        apex = answer(server, DOMAIN, 'A')
        ipv4 = {row[4] for row in apex if len(row) >= 5 and row[3] == 'A'}
        cname = {row[4].lower() for row in answer(server, WWW, 'CNAME')
                 if len(row) >= 5 and row[3] == 'CNAME'}
        ipv6 = [row for row in answer(server, DOMAIN, 'AAAA')
                if len(row) >= 5 and row[3] == 'AAAA']
        if ipv4 != {ADDRESS} or cname != {DOMAIN + '.'} or ipv6:
            return False
    return True


def certificate_ready():
    if not CERT.is_file() or not KEY.is_file():
        return False
    expiry = run(['openssl', 'x509', '-in', str(CERT), '-noout', '-checkend', '86400'])
    names = run(['openssl', 'x509', '-in', str(CERT), '-noout', '-ext', 'subjectAltName'])
    dns_names = set(re.findall(r'\bDNS:([^,\s]+)', names.stdout))
    # OpenSSL's x509 -checkhost returns zero even for a nonmatching hostname;
    # inspect the SANs explicitly, then curl verifies the actual TLS connection.
    return expiry.returncode == 0 and names.returncode == 0 and {DOMAIN, WWW} <= dns_names


def replace_config(content):
    temporary = LIVE.with_name('.uzdonate.uz.next')
    temporary.write_bytes(content)
    temporary.chmod(0o644)
    os.replace(temporary, LIVE)


def enable_https():
    desired = (TEMPLATES / 'nginx-uzdonate-https.conf').read_bytes()
    current = LIVE.read_bytes()
    bootstrap = (TEMPLATES / 'nginx-uzdonate-http.conf').read_bytes()
    if current not in [bootstrap, desired]:
        raise RuntimeError('Domain virtual host changed; manual review required')
    if current == desired and state.get('tlsEnabled'):
        return
    reserve(90)
    backup = STATE_DIR / 'nginx-before-https.conf'
    if not backup.exists():
        backup.write_bytes(current)
        backup.chmod(0o600)
    try:
        replace_config(desired)
        if run(['nginx', '-t']).returncode != 0:
            raise RuntimeError('New nginx configuration rejected')
        if run(['systemctl', 'reload', 'nginx']).returncode != 0:
            raise RuntimeError('Nginx reload failed')
    except BaseException:
        replace_config(current)
        # Rollback gets a separate short cleanup allowance even when the
        # invocation's nine-minute work budget has just expired.
        try:
            checked = subprocess.run(['nginx', '-t'], capture_output=True, timeout=20)
            if checked.returncode == 0:
                subprocess.run(['systemctl', 'reload', 'nginx'],
                               capture_output=True, timeout=20)
        except subprocess.TimeoutExpired:
            log('Nginx rollback command timed out; manual inspection is required.')
        raise
    state['tlsEnabled'] = True
    save('tls-enabled')
    log('HTTPS virtual host enabled; checking reachability.')


def https_ready():
    # Validates certificate/hostname and upstream readiness without local DNS
    # negative caches. Render's own upstream TLS is checked by nginx.
    for path in ['/health', '/ready', '/api/v1/app/config', '/webapp/', '/admin/',
                 '/privacy.html', '/terms.html']:
        reserve(150)
        result = run(['curl', '--fail', '--silent', '--show-error',
                      '--connect-timeout', '5', '--max-time', '135',
                      '--resolve', f'{DOMAIN}:443:127.0.0.1',
                      f'https://{DOMAIN}{path}'], 140)
        if result.returncode != 0:
            return False
    for name in [DOMAIN, WWW]:
        reserve(150)
        result = run(['curl', '--fail', '--location', '--max-redirs', '5',
                      '--silent', '--show-error',
                      '--connect-timeout', '5', '--max-time', '135',
                      f'https://{name}/ready'], 140)
        if result.returncode != 0:
            return False
    return True


def main():
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = (STATE_DIR / 'worker.lock').open('w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return 0
    if STATE_FILE.exists():
        state.update(json.loads(STATE_FILE.read_text()))
    else:
        state.update({'startedAt': int(time.time()), 'deadline': int(time.time()) + 86400,
                      'certificateAttempts': 0, 'lastCertificateAttempt': 0})
    if state.get('status') == 'complete':
        return stop('complete', 'HTTPS completion already verified.')
    if state['deadline'] - time.time() < 60:
        return stop('expired', 'Domain completion expired; manual review required.', True)
    if not dns_ready():
        save('waiting-for-delegation')
        log('Waiting for registry delegation and authoritative DNS records.')
        return 0
    if not certificate_ready():
        if state['certificateAttempts'] >= 3:
            return stop('certificate-attempt-limit', 'Certificate attempt limit reached.', True)
        if time.time() - state['lastCertificateAttempt'] < 3600:
            save('waiting-before-certificate-retry')
            log('Waiting before the next permitted certificate attempt.')
            return 0
        reserve(330)
        state['certificateAttempts'] += 1
        state['lastCertificateAttempt'] = int(time.time())
        save('issuing-certificate')
        result = run(['certbot', 'certonly', '--non-interactive', '--quiet',
                      '--webroot', '--webroot-path', '/var/www/letsencrypt',
                      '--server', 'https://acme-v02.api.letsencrypt.org/directory',
                      '--cert-name', DOMAIN, '-d', DOMAIN, '-d', WWW], 300)
        # Keep ACME diagnostics private; never emit process environment values.
        diagnostics = STATE_DIR / 'certbot-last-attempt.log'
        diagnostics.write_text(result.stdout + result.stderr)
        diagnostics.chmod(0o600)
        if result.returncode != 0 or not certificate_ready():
            save('certificate-attempt-failed')
            log('Certificate attempt failed; bounded retry will wait at least one hour.')
            return 0
    enable_https()
    if not https_ready():
        save('tls-enabled-awaiting-public-reachability')
        log('HTTPS enabled; waiting for public DNS caches or upstream readiness.')
        return 0
    (STATE_DIR / 'complete').write_text(time.strftime('%Y-%m-%dT%H:%M:%SZ\n', time.gmtime()))
    return stop('complete', 'Domain HTTPS and public reachability verified; timer disabled.')


def interrupted(_signum, _frame):
    raise InvocationBudgetExpired('Invocation interrupted')


if __name__ == '__main__':
    os.umask(0o077)
    signal.signal(signal.SIGTERM, interrupted)
    try:
        raise SystemExit(main())
    except InvocationBudgetExpired:
        if state:
            save('retry-after-invocation-budget')
        log('Invocation budget exhausted; the bounded completion timer remains active.')
        raise SystemExit(0)
    except CompletionDeadlineExpired:
        stop('expired', 'Domain completion deadline reached; timer disabled.', True)
        raise SystemExit(1)
    except Exception as error:
        if state:
            stop('manual-review-required', f'Completion stopped: {type(error).__name__}.', True)
        else:
            subprocess.run(['systemctl', 'disable', '--now', TIMER],
                           capture_output=True, timeout=15, check=False)
            log(f'Completion stopped before state could be loaded: {type(error).__name__}.')
        raise SystemExit(1)
