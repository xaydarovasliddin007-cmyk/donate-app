import { env } from '../src/config/env.js';
import { telegramApi } from '../src/modules/telegram/telegram-api.js';

async function main() {
  if (!env.PUBLIC_APP_URL?.startsWith('https://') || !env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_BOT_TOKEN) {
    throw new Error('Set PUBLIC_APP_URL (HTTPS), TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET on the server first.');
  }
  const origin = new URL(env.PUBLIC_APP_URL).origin;
  const response = await fetch(`${origin}/api/${env.API_VERSION}/telegram/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET },
    body: JSON.stringify({ update_id: 0 }), signal: AbortSignal.timeout(25000),
  });
  if (!response.ok || !(await response.json() as { ok?: boolean }).ok) {
    throw new Error('Deploy the new backend with the same webhook secret before configuring the bot.');
  }
  const page = await fetch(`${origin}/webapp/`, { signal: AbortSignal.timeout(25000) });
  if (!page.ok || !(await page.text()).includes('assets/')) throw new Error('Mini app build is not available at /webapp/.');
  const me = await telegramApi<{ username: string }>('getMe', {});
  await telegramApi('setWebhook', {
    url: `${origin}/api/${env.API_VERSION}/telegram/webhook`, secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'pre_checkout_query'], drop_pending_updates: false,
  });
  await telegramApi('setChatMenuButton', { menu_button: { type: 'web_app', text: "Do'kon", web_app: { url: `${origin}/webapp/` } } });
  await telegramApi('setMyCommands', { commands: [
    { command: 'start', description: "UZDONATE do'konini ochish" },
    { command: 'shop', description: "O'yinlar va paketlar" },
    { command: 'paysupport', description: "To'lov bo'yicha yordam" },
    { command: 'help', description: 'Yordam xizmati' },
  ] });
  await telegramApi('setMyDescription', { description: "UZDONATE: o'yin valyutalari va obunalar. Do'konni oching, paketni tanlang va buyurtmangizni kuzating." });
  console.log(`Configured https://t.me/${me.username} -> ${origin}/webapp/`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Bot setup failed'); process.exitCode = 1; });
