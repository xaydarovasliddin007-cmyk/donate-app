import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison for secrets/signatures (webhook shared
 * secrets, HMAC/MD5 signature checks) — a plain `===` leaks timing
 * information proportional to the matching prefix length.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // timingSafeEqual throws on length mismatch — compare against a
    // same-length dummy first so a wrong-length input still takes the
    // same code path instead of short-circuiting.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
