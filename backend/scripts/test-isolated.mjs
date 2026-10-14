import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const databaseDir = path.resolve(root, 'artifacts', `test-db-${Date.now()}`);
if (!databaseDir.startsWith(path.resolve(root, 'artifacts') + path.sep)) throw new Error('Invalid test database path');
const password = randomBytes(24).toString('hex');
const preview = process.argv.includes('--preview');
const port = preview ? 55433 : 55432;
const pg = new EmbeddedPostgres({ databaseDir, user: 'postgres', password, port, persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {},
});
const env = { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error',
  PORT: '4001', HOST: '127.0.0.1',
  DOTENV_CONFIG_PATH: path.join(databaseDir, 'no-secrets.env'),
  DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/donate_test`,
  TELEGRAM_WEBHOOK_SECRET: 'isolated-review-webhook-secret-32-bytes',
  TOPUP_REVIEW_BOT_TOKEN: '123456789:isolated-test-token',
  TOPUP_REVIEW_CHAT_ID: '123456789',
  TELEGRAM_ADMIN_CHAT_ID: '', SMTP_HOST: '',
};
// dotenv must not load real notification/provider credentials into isolated tests.
delete env.TELEGRAM_ADMIN_CHAT_ID;
delete env.SMTP_HOST;
const backendDir = path.join(root, 'backend');
function runInstalled(relativeCli, args) {
  execFileSync(process.execPath, [path.join(backendDir, 'node_modules', relativeCli), ...args],
    { cwd: backendDir, env, stdio: 'inherit' });
}
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('donate_test');
  console.log(`Isolated PostgreSQL started on 127.0.0.1:${port}`);
  runInstalled('prisma/build/index.js', ['migrate', 'deploy']);
  runInstalled('tsx/dist/cli.mjs', ['prisma/seed.ts']);
  if (preview) {
    console.log('LOCAL TEST PREVIEW: http://localhost:4001/webapp/ and /admin/ (not production)');
    const child = spawn(process.execPath, ['dist/server.js'], { cwd: path.join(root, 'backend'), env, stdio: 'inherit' });
    await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code) => code ? reject(new Error(`Preview exited ${code}`)) : resolve()); });
  } else runInstalled('vitest/vitest.mjs', ['run']);
} catch (error) { console.error(error instanceof Error ? error.message.replaceAll(password, '[redacted]') : 'Tests failed'); process.exitCode = 1; }
finally { const exitCode = process.exitCode ?? 0; await pg.stop(); process.exit(exitCode); }
