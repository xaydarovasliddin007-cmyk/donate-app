import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { UnauthorizedError } from '../../lib/errors.js';

const telegramUserSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  first_name: z.string().min(1).max(256),
  last_name: z.string().max(256).optional(),
  language_code: z.string().optional(),
  photo_url: z.string().url().optional(),
});

export function validateTelegramInitData(initData: string, botToken: string, now = Date.now()) {
  const params = new URLSearchParams(initData);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new UnauthorizedError('Invalid Telegram session');
  const hash = params.get('hash') ?? '';
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new UnauthorizedError('Invalid Telegram signature');
  params.delete('hash');
  params.sort();
  const checkString = [...params].map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) {
    throw new UnauthorizedError('Invalid Telegram signature');
  }
  const authDate = Number(params.get('auth_date'));
  const age = now / 1000 - authDate;
  if (!Number.isInteger(authDate) || authDate <= 0 || age > 3600 || age < -30) {
    throw new UnauthorizedError('Telegram session expired. Reopen the mini app.');
  }
  try {
    return telegramUserSchema.parse(JSON.parse(params.get('user') ?? 'null'));
  } catch {
    throw new UnauthorizedError('Invalid Telegram user');
  }
}
