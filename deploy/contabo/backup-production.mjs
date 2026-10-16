import { readFileSync, statSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { parse } = require('dotenv');
const credential = parse(readFileSync(path.join(process.env.CREDENTIALS_DIRECTORY, 'environment')));
const database = new URL(credential.DATABASE_URL);
const output = `/var/backups/uzdonate/production-${new Date().toISOString().replaceAll(':', '-')}.dump.age`;
const recipient = readFileSync('/etc/ssh/ssh_host_ed25519_key.pub', 'utf8').trim();
function completion(child, label) {
  return new Promise((resolve, reject) => {
    const finished = code => code === 0 ? resolve() : reject(new Error(`${label} failed (${code})`));
    child.once('error', () => reject(new Error(`${label} could not start`)));
    child.once('exit', finished);
    if (child.exitCode !== null) finished(child.exitCode);
    child.stderr.resume();
  });
}
const dump = spawn('/usr/lib/postgresql/18/bin/pg_dump', ['--format=custom', '--no-owner', '--no-acl'], {
  env: { ...process.env, PGHOST: database.hostname, PGPORT: database.port || '5432',
    PGDATABASE: decodeURIComponent(database.pathname.slice(1)), PGUSER: decodeURIComponent(database.username),
    PGPASSWORD: decodeURIComponent(database.password), PGSSLMODE: 'require' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const dumpDone = completion(dump, 'Database backup');
const encrypt = spawn('/usr/bin/age', ['--recipient', recipient, '--output', output], { stdio: ['pipe', 'ignore', 'pipe'] });
const encryptDone = completion(encrypt, 'Backup encryption');
encrypt.stdin.on('error', () => {});
dump.stdout.pipe(encrypt.stdin);
try {
  await Promise.all([dumpDone, encryptDone]);
  const decrypt = spawn('/usr/bin/age', ['--decrypt', '--identity', '/etc/ssh/ssh_host_ed25519_key', output], { stdio: ['ignore', 'pipe', 'pipe'] });
  const decryptDone = completion(decrypt, 'Backup decryption check');
  const inspect = spawn('/usr/lib/postgresql/18/bin/pg_restore', ['--list'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const inspectDone = completion(inspect, 'Backup archive check');
  let archiveEntries = 0;
  inspect.stdout.on('data', chunk => { archiveEntries += chunk.toString().split('\n').filter(line => /^\d+;/.test(line)).length; });
  inspect.stdin.on('error', () => {});
  decrypt.stdout.pipe(inspect.stdin);
  await Promise.all([decryptDone, inspectDone]);
  if (archiveEntries < 10) throw new Error('Backup archive is incomplete');
  console.log(JSON.stringify({ backup: output, encryptedBytes: statSync(output).size, archiveEntries, verified: true }));
} catch (error) {
  dump.kill(); encrypt.kill();
  try { unlinkSync(output); } catch {}
  throw error;
}
