import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('wallet route protection', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('GET /api/v1/wallet without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/wallet' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('GET /api/v1/wallet/transactions without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/wallet/transactions' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/payments/wallet without a token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/wallet',
      payload: { orderId: '00000000-0000-0000-0000-000000000000', idempotencyKey: 'x'.repeat(10) },
    });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: actual credit/debit/balance behavior — requires a
  // live PostgreSQL instance (the atomicity guarantees are a DB feature).
  // See backend/README.md and wallet.service.ts's own documentation.

  afterAll(async () => {
    await app.close();
  });
});
