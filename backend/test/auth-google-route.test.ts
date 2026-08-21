import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('POST /api/v1/auth/google', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('rejects a malformed body before touching Google or the database', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  // Stubs env.GOOGLE_CLIENT_ID rather than relying on it being unset in
  // .env — this machine has real Google Sign-In credentials configured for
  // actual use, so the "unconfigured" path must be forced explicitly to stay
  // testable. verifyGoogleIdToken() must refuse before ever reaching Prisma,
  // so this is safely testable without a DB.
  it('returns 503 when Google sign-in is not configured on this server', async () => {
    const original = env.GOOGLE_CLIENT_ID;
    env.GOOGLE_CLIENT_ID = undefined;
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/google',
        payload: { idToken: 'irrelevant-because-unconfigured' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
    } finally {
      env.GOOGLE_CLIENT_ID = original;
    }
  });

  // Not covered here: successful user creation, linking an existing
  // email/password account (only when Google reports the email verified),
  // and duplicate-account prevention on repeat sign-in with the same
  // googleId — all require a live PostgreSQL instance to exercise
  // meaningfully (auth.service.ts's googleAuth() reads/writes via Prisma
  // once the token is verified). See backend/README.md.

  afterAll(async () => {
    await app.close();
  });
});
