import { env } from '../../config/env.js';
import { ServiceUnavailableError } from '../../lib/errors.js';

export class TelegramApiError extends ServiceUnavailableError {
  constructor(public readonly description: string) {
    super('Telegram is temporarily unavailable');
  }
}

async function telegramRequest<T>(method: string, body: string | FormData, headers?: Record<string, string>): Promise<T> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new ServiceUnavailableError('Telegram bot is not configured');
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers, body, signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ServiceUnavailableError('Telegram connection failed');
  }
  const data = await response.json() as { ok: boolean; result: T; description?: string };
  if (!response.ok || !data.ok) throw new TelegramApiError(data.description ?? 'Telegram request failed');
  return data.result;
}

export function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  return telegramRequest<T>(method, JSON.stringify(body), { 'Content-Type': 'application/json' });
}

/** Let fetch generate the multipart boundary instead of setting Content-Type. */
export function telegramApiUpload<T>(method: string, body: FormData): Promise<T> {
  return telegramRequest<T>(method, body);
}
