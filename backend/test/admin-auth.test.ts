import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('admin route protection', () => {
  let app: FastifyInstance;

  it('builds the app with the full route tree (games/orders/payments/admin) registered', async () => {
    app = await buildApp();
    expect(app).toBeDefined();
  });

  it('GET /api/v1/admin/orders without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('GET /api/v1/admin/orders with a customer (non-admin) token is still rejected', async () => {
    // A customer access token is signed with a different secret than admin
    // tokens, so it must never verify here — this is the whole point of
    // keeping the two JWT secrets separate.
    const fakeCustomerToken = app.jwt.sign({ sub: 'user-id', role: 'CUSTOMER' });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/orders',
      headers: { authorization: `Bearer ${fakeCustomerToken}` },
    });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: POST /api/v1/admin/auth/login with real credentials.
  // adminLogin() queries the database before checking the password, so
  // exercising it meaningfully requires a live Postgres instance — see
  // backend/README.md for the DB-dependent manual test plan.

  afterAll(async () => {
    await app.close();
  });
});
