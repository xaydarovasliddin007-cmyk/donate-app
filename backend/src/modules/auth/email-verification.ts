import { randomInt, createHash } from 'node:crypto';

/**
 * A 6-digit numeric code rather than a link — the mobile app just asks the
 * user to type it, no deep-link handling needed. Only the hash is persisted,
 * same reasoning as refresh-token.ts.
 */
export function generateVerificationCode(): { code: string; codeHash: string } {
  const code = randomInt(100000, 1000000).toString();
  return { code, codeHash: hashVerificationCode(code) };
}

export function hashVerificationCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
