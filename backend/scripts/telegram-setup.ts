import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../src/config/env.js';
import { telegramApi } from '../src/modules/telegram/telegram-api.js';
import { STORE_BOT_DESCRIPTIONS, storeBotCommands } from '../src/modules/telegram/telegram-storefront.js';
import { profilePhotoForm, setStoreBotProfilePhoto } from '../src/modules/telegram/telegram-branding.js';

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
  const card = await fetch(`${origin}/webapp/assets-store/brand-bot-card.png`, { signal: AbortSignal.timeout(25000) });
  if (!card.ok || !card.headers.get('content-type')?.includes('image/png')) {
    throw new Error('Deploy the UZDONATE brand card at /webapp/assets-store/brand-bot-card.png before configuring the bot.');
  }
  const cardBytes = new Uint8Array(await card.arrayBuffer());
  if (cardBytes.length < 64 || cardBytes[0] !== 0x89 || cardBytes[1] !== 0x50 || cardBytes[2] !== 0x4e || cardBytes[3] !== 0x47) {
    throw new Error('The deployed bot brand card is not a valid PNG image.');
  }
  // Validate local bytes before changing any bot settings. Profile updates are explicit.
  const profileFlag = process.argv.find((arg) => arg === '--brand-profile' || arg.startsWith('--brand-profile='));
  const profilePath = profileFlag?.startsWith('--brand-profile=') ? profileFlag.slice('--brand-profile='.length) : undefined;
  if (profilePath === '') throw new Error('Pass --brand-profile or --brand-profile=/absolute/path/to/profile.jpg');
  const profile = profileFlag
    ? await readFile(profilePath ? resolve(profilePath) : new URL('../../mobile/assets/branding/brand-profile.jpg', import.meta.url))
    : undefined;
  if (profile) profilePhotoForm(profile);
  const me = await telegramApi<{ username: string }>('getMe', {});
  await telegramApi('setWebhook', {
    url: `${origin}/api/${env.API_VERSION}/telegram/webhook`, secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'pre_checkout_query'], drop_pending_updates: false,
  });
  await telegramApi('setChatMenuButton', { menu_button: {
    type: 'web_app', text: STORE_BOT_DESCRIPTIONS.uz.menuButton, web_app: { url: `${origin}/webapp/` },
  } });
  await telegramApi('setMyName', { name: 'UZDONATE' });
  await telegramApi('setMyCommands', { commands: storeBotCommands() });
  await telegramApi('setMyDescription', { description: STORE_BOT_DESCRIPTIONS.uz.description });
  await telegramApi('setMyShortDescription', { short_description: STORE_BOT_DESCRIPTIONS.uz.shortDescription });
  for (const language_code of ['uz', 'ru', 'en'] as const) {
    await telegramApi('setMyCommands', { commands: storeBotCommands(language_code), language_code });
    await telegramApi('setMyDescription', { description: STORE_BOT_DESCRIPTIONS[language_code].description, language_code });
    await telegramApi('setMyShortDescription', { short_description: STORE_BOT_DESCRIPTIONS[language_code].shortDescription, language_code });
  }
  if (profile) await setStoreBotProfilePhoto(profile);
  console.log(`Configured https://t.me/${me.username} -> ${origin}/webapp/`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Bot setup failed'); process.exitCode = 1; });
