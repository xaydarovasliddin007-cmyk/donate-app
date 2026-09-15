import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateTelegramInitData } from '../src/modules/telegram/telegram-auth.js';

const token = '123456:test-only-bot-secret';
const now = 1789420800000;
function signed(values: Record<string, string> = {}) {
  const params = new URLSearchParams({ auth_date: String(now / 1000), user: JSON.stringify({ id: 1234567890123, first_name: 'Tester' }), ...values });
  params.sort();
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const signature = createHmac('sha256', secret).update([...params].map(([key, value]) => `${key}=${value}`).join('\n')).digest('hex');
  params.set('hash', signature);
  return params.toString();
}
describe('Telegram signed login', () => {
  it('accepts the signed 52-bit Telegram identity', () => expect(validateTelegramInitData(signed(), token, now).id).toBe(1234567890123));
  it('rejects a forged user identity', () => expect(() => validateTelegramInitData(signed().replace('Tester', 'Attacker'), token, now)).toThrow());
  it('rejects a token signed by a different bot', () => expect(() => validateTelegramInitData(signed(), 'other-bot', now)).toThrow());
  it('rejects expired or future sessions', () => {
    expect(() => validateTelegramInitData(signed({ auth_date: String(now / 1000 - 3601) }), token, now)).toThrow();
    expect(() => validateTelegramInitData(signed({ auth_date: String(now / 1000 + 31) }), token, now)).toThrow();
  });
  it('rejects duplicate query keys and malformed signed users', () => {
    expect(() => validateTelegramInitData(`${signed()}&auth_date=1`, token, now)).toThrow();
    expect(() => validateTelegramInitData(signed({ user: '{}' }), token, now)).toThrow();
    expect(() => validateTelegramInitData('hash=00', token, now)).toThrow();
  });
});
