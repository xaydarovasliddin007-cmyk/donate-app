import { env } from '../../config/env.js';
import { ServiceUnavailableError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export async function topUpReviewBotApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!env.TOPUP_REVIEW_BOT_TOKEN) {
    throw new ServiceUnavailableError('Top-up review bot is not configured');
  }

  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API_BASE}/bot${env.TOPUP_REVIEW_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ServiceUnavailableError('Top-up review bot connection failed');
  }

  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    result?: T;
    description?: string;
  } | null;
  if (!response.ok || !payload?.ok) {
    throw new ServiceUnavailableError(payload?.description ?? 'Top-up review bot request failed');
  }
  return payload.result as T;
}

export async function configureTopUpReviewWebhook() {
  if (!env.TOPUP_REVIEW_BOT_TOKEN || !env.TOPUP_REVIEW_CHAT_ID) return;
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.PUBLIC_APP_URL?.startsWith('https://')) {
    logger.warn('Top-up review bot is configured without an HTTPS webhook secret or public URL');
    return;
  }

  const origin = new URL(env.PUBLIC_APP_URL).origin;
  try {
    await topUpReviewBotApi('setWebhook', {
      url: `${origin}/api/${env.API_VERSION}/telegram/topup-review-webhook`,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['callback_query'],
      drop_pending_updates: false,
    });
    logger.info('Top-up review Telegram webhook configured');
  } catch (err) {
    logger.warn({ err }, 'Top-up review Telegram webhook setup failed');
  }
}
