import { env } from '../config/env.js';
import { logger } from './logger.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function isConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID);
}

/**
 * Fire-and-forget admin alert via the Telegram Bot API — a real integration
 * (calls the actual Bot API), not a fake one, but it genuinely can't do
 * anything without a bot token the operator has to create in Telegram
 * themselves (see README "Telegram setup"). Never throws and never awaited
 * by callers for its result: a Telegram outage or missing config must never
 * break an order/payment/top-up flow, so every call site fires this and
 * moves on immediately.
 */
export function notifyAdmins(message: string): void {
  if (!isConfigured()) {
    logger.debug({ message }, 'Telegram notification skipped: TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID not set');
    return;
  }

  const url = `${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.warn({ status: response.status, body }, 'Telegram notification failed');
      }
    })
    .catch((err: unknown) => {
      logger.warn({ err }, 'Telegram notification failed');
    });
}
