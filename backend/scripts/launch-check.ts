import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { getTopupProvider } from '../src/providers/registry.js';
import { telegramApi } from '../src/modules/telegram/telegram-api.js';

const prisma = new PrismaClient();
let failed = false;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failed = true;
}
try {
  check('Admin bundle', existsSync('public/admin/index.html'));
  check('Mini app bundle', existsSync('public/webapp/index.html'));
  const secrets = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET, env.ADMIN_JWT_ACCESS_SECRET];
  check('Private independent JWT secrets', secrets.every((s) => s.length >= 32 && !/fallback|replace-with/i.test(s)) && new Set(secrets).size === 3);
  check('HTTPS app URL', Boolean(env.PUBLIC_APP_URL?.startsWith('https://')));
  check('Telegram webhook secret', Boolean(env.TELEGRAM_WEBHOOK_SECRET));
  if (env.TELEGRAM_BOT_TOKEN) {
    try { const me = await telegramApi<{ username: string }>('getMe', {}); check('Telegram bot', true, `@${me.username}`); }
    catch { check('Telegram bot credentials', false); }
  } else check('Telegram bot credentials', false);
  await prisma.$queryRaw`SELECT 1`;
  check('Database', true);
  const admins = await prisma.adminUser.count({ where: { isActive: true } });
  check('Active administrator', admins > 0);
  const products = await prisma.product.findMany({
    where: { isActive: true, isTest: false, game: { availability: 'ACTIVE' } },
    include: { providerProducts: { where: { isActive: true, provider: { isActive: true } }, include: { provider: true }, orderBy: { priority: 'asc' } } },
  });
  check('Real catalog products', products.length > 0, String(products.length));
  const starsProducts = products.filter((p) => p.starsPrice != null);
  check('Telegram Stars prices set in admin', starsProducts.length > 0, String(starsProducts.length));
  const unavailable = products.filter((product) => {
    const provider = product.providerProducts[0]?.provider;
    if (!provider || provider.code.startsWith('DEV_')) return true;
    try { getTopupProvider(provider.code); return false; } catch { return true; }
  });
  check('Active product fulfillment configured', unavailable.length === 0, `${unavailable.length} unavailable product(s)`);
  const methods = await prisma.receivingMethod.count({ where: { isActive: true } });
  check('App wallet receiving methods', methods > 0);
} catch (error) {
  const detail = error instanceof Error ? error.message.split('\n').filter(Boolean).at(-1) : 'Unknown database error';
  check('Database/schema access', false, detail);
}
finally { await prisma.$disconnect(); }
console.log('Live delivery and settlement still require a controlled operator purchase with real provider accounts.');
process.exitCode = failed ? 1 : 0;
