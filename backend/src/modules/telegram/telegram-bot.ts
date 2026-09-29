import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { telegramApi } from './telegram-api.js';

export async function configureStoreBotWebhook() {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.PUBLIC_APP_URL?.startsWith('https://')) {
    logger.warn('Store Telegram bot has no HTTPS webhook URL or webhook secret');
    return;
  }

  const origin = new URL(env.PUBLIC_APP_URL).origin;
  try {
    await telegramApi('setWebhook', {
      url: `${origin}/api/${env.API_VERSION}/telegram/webhook`,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'pre_checkout_query'],
      drop_pending_updates: false,
    });
    logger.info('Store Telegram webhook configured');
  } catch (err) {
    logger.warn({ err }, 'Store Telegram webhook setup failed');
  }
}
