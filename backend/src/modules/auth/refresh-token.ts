import { randomBytes, createHash } from 'node:crypto';

/**
 * Refresh tokens are opaque random strings, not JWTs: we need to be able to
 * revoke a single token or an entire session family from the database
 * (rotation-theft detection), which isn't possible with self-contained JWTs.
 * Only the SHA-256 hash is persisted, so a leaked database dump doesn't hand
 * out usable tokens.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(64).toString('hex');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
