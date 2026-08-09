import { createSigner, createVerifier } from 'fast-jwt';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../lib/duration.js';

/**
 * Admin access tokens are signed/verified with `fast-jwt` directly rather
 * than a second @fastify/jwt plugin registration: Fastify's decorateRequest
 * rejects re-declaring the same request property from a nested plugin, and
 * fighting that with @fastify/jwt's `namespace` option is more fragile than
 * just using the small library it's built on. Always a different secret
 * (ADMIN_JWT_ACCESS_SECRET) from the customer-facing tokens.
 */
export interface AdminTokenPayload {
  sub: string;
  role: string;
  scope: 'admin';
}

const sign = createSigner({
  key: env.ADMIN_JWT_ACCESS_SECRET,
  expiresIn: parseDurationMs(env.ADMIN_JWT_ACCESS_TTL),
});
const verify = createVerifier({ key: env.ADMIN_JWT_ACCESS_SECRET });

export function signAdminAccessToken(payload: AdminTokenPayload): string {
  return sign(payload);
}

export async function verifyAdminAccessToken(token: string): Promise<AdminTokenPayload> {
  return verify(token) as Promise<AdminTokenPayload>;
}
