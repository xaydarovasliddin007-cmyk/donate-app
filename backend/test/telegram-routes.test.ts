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
  it('rejects unsigned bankomat review callbacks', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/telegram/topup-review-webhook',
      payload: { update_id: 1, callback_query: { id: 'callback', from: { id: 123456789 } } },
    });
    expect(response.statusCode).toBe(403);
  });
  it('ignores review button clicks outside the configured private admin chat', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/telegram/topup-review-webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'isolated-review-webhook-secret-32-bytes' },
      payload: {
        update_id: 2,
        callback_query: {
          id: 'callback',
          from: { id: 987654321 },
          data: 'topup:approve:9efc2f4e-7b3b-4d0a-84af-628357311afe',
          message: { message_id: 10, chat: { id: 987654321, type: 'private' }, caption: 'Bankomat cheki' },
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
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
