import { describe, expect, it, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('topup route protection', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('GET /api/v1/topups/receiving-methods is public (browsing needs no auth)', async () => {
    // Should not 401 — only DB unavailability can fail this in this environment.
    const response = await app.inject({ method: 'GET', url: '/api/v1/topups/receiving-methods' });
    expect(response.statusCode).not.toBe(401);
  });

  it('GET /api/v1/topups/options is public', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/topups/options' });
    expect(response.statusCode).not.toBe(401);
  });

  it('POST /api/v1/topups without a token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topups',
      payload: { receivingMethodId: '00000000-0000-0000-0000-000000000000', amountMinor: 10000 },
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/topups without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/topups' });
    expect(response.statusCode).toBe(401);
  });

  it('limits receipt retries per customer instead of sharing one IP quota', async () => {
    const requestId = randomUUID();
    const payload = { fileName: 'receipt.jpg', mimeType: 'image/jpeg', dataBase64: 'dGVzdC1yZWNlaXB0LWltYWdl' };
    const sendReceipt = (userId: string) => app.inject({
      method: 'POST',
      url: `/api/v1/topups/${requestId}/receipt`,
      headers: { authorization: `Bearer ${app.jwt.sign({ sub: userId, role: 'USER' })}` },
      payload,
    });
    const firstUser = randomUUID();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await sendReceipt(firstUser)).statusCode).toBe(404);
    }
    expect((await sendReceipt(firstUser)).statusCode).toBe(429);
    expect((await sendReceipt(randomUUID())).statusCode).toBe(404);
  });

  it('GET /api/v1/admin/topups without an admin token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/topups' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/admin/receiving-methods without an admin token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/receiving-methods',
      payload: { cardNumber: '8600 **** **** 1234', cardHolderName: 'UZDONATE' },
    });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: actual request creation/verification/rejection —
  // requires a live PostgreSQL instance. See backend/README.md.

  afterAll(async () => {
    await app.close();
  });
});
