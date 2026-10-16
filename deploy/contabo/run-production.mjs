import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// systemd decrypts this credential into the service's private memory filesystem.
// The persistent credential and release archives never contain plaintext keys.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { parse } = require('dotenv');
const credentialDirectory = process.env.CREDENTIALS_DIRECTORY;
if (!credentialDirectory) throw new Error('Encrypted production credential is required');
Object.assign(process.env, parse(readFileSync(path.join(credentialDirectory, 'environment'))));
Object.assign(process.env, {
  NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4003',
  PUBLIC_APP_URL: 'https://uzdonate.uz', CORS_ORIGIN: 'https://uzdonate.uz',
});
delete process.env.RENDER;

if (process.argv.includes('--check')) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const [database] = await prisma.$queryRaw`SELECT current_setting('server_version') AS version, current_setting('default_transaction_read_only') AS read_only, (has_table_privilege(current_user, 'users', 'INSERT') AND has_table_privilege(current_user, 'users', 'UPDATE')) AS user_writes, (has_table_privilege(current_user, 'wallet_transactions', 'INSERT') AND has_table_privilege(current_user, 'wallet_transactions', 'UPDATE')) AS ledger_writes`;
    const migrations = await prisma.$queryRaw`SELECT count(*)::int AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const counts = { users: await prisma.user.count(), orders: await prisma.order.count(), receipts: await prisma.topUpReceipt.count() };
    const integrations = Object.fromEntries(['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TOPUP_REVIEW_BOT_TOKEN','TOPUP_REVIEW_CHAT_ID','TELEGRAM_API_ID','TELEGRAM_API_HASH','TELEGRAM_SESSION','CARD_TRANSACTION_WEBHOOK_SECRET','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','RSC_API_KEY','G2BULK_API_KEY'].map(key => [key, Boolean(process.env[key])]));
    console.log(JSON.stringify({ database, migrations, counts, integrations }));
    if (database.read_only !== 'off' || !database.user_writes || !database.ledger_writes) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
} else if (process.env.UZDONATE_RUNTIME_MODE === 'standby') {
  // Preflight serves HTTP without claiming bot webhooks, Telegram user sessions,
  // or pending fulfillment work while Render is still the primary process.
  const { buildApp } = await import(pathToFileURL(path.join(process.cwd(), 'dist/app.js')));
  const app = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 4003 });
  process.once('SIGTERM', async () => { await app.close(); process.exit(0); });
} else {
  await import(pathToFileURL(path.join(process.cwd(), 'dist/server.js')));
}
