import { env } from '../config/env.js';
import { ServiceUnavailableError } from './errors.js';
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

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function sendTopUpReceiptPhoto(input: {
  image: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileName: string;
  requestId: string;
  userLabel: string;
  amount: string;
}) {
  if (!env.TOPUP_REVIEW_BOT_TOKEN || !env.TOPUP_REVIEW_CHAT_ID) {
    throw new ServiceUnavailableError('Receipt review bot is not configured');
  }
  const form = new FormData();
  form.append('chat_id', env.TOPUP_REVIEW_CHAT_ID);
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  form.append('photo', new Blob([new Uint8Array(input.image)], { type: input.mimeType }), safeFileName);
  form.append('parse_mode', 'HTML');
  form.append('caption',
    `🧾 <b>Bankomat cheki</b>\n` +
    `Summa: <b>${escapeHtml(input.amount)}</b>\n` +
    `Mijoz: ${escapeHtml(input.userLabel)}\n` +
    `So'rov: <code>${escapeHtml(input.requestId)}</code>\n` +
    `Admin panelda tekshirib tasdiqlang.`,
  );
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${env.TOPUP_REVIEW_BOT_TOKEN}/sendPhoto`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string } | null;
  const messageId = payload?.result?.message_id;
  if (!response.ok || !payload?.ok || !messageId) {
    logger.warn({ status: response.status, description: payload?.description }, 'Top-up receipt photo delivery failed');
    throw new ServiceUnavailableError('Receipt image could not be delivered for review');
  }
  return messageId;
}
