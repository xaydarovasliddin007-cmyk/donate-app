import { env } from '../../config/env.js';
import { ServiceUnavailableError } from '../../lib/errors.js';

export class TelegramApiError extends ServiceUnavailableError {
  constructor(public readonly description: string) {
    super('Telegram is temporarily unavailable');
  }
}

export async function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new ServiceUnavailableError('Telegram bot is not configured');
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ServiceUnavailableError('Telegram connection failed');
  }
  const data = await response.json() as { ok: boolean; result: T; description?: string };
  if (!response.ok || !data.ok) throw new TelegramApiError(data.description ?? 'Telegram request failed');
  return data.result;
}
