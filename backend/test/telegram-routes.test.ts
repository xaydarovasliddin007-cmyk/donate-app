import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
let app: FastifyInstance;
describe('Telegram endpoint boundaries', () => {
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); });
  it('rejects unsigned Telegram updates', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/telegram/webhook', payload: { update_id: 1 } });
    expect(response.statusCode).toBe(403);
  });
  it('does not expose the old public bot-reconfiguration endpoint', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/telegram/set-webhook', payload: {} });
    expect(response.statusCode).toBe(404);
  });
  it('requires authentication before creating invoices', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/telegram/invoices', payload: {} });
    expect(response.statusCode).toBe(401);
  });
  it('does not serve index.html for missing JavaScript assets', async () => {
    const response = await app.inject('/webapp/assets/missing.js');
    expect(response.statusCode).toBe(404);
  });
  it('prevents Telegram from retaining a stale webapp shell', async () => {
    const response = await app.inject('/webapp/?v=current');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(response.headers.pragma).toBe('no-cache');
  });
});
