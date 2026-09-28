import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  it('credits a late Bankomat receipt from the configured admin approve button', async () => {
    const userId = randomUUID();
    const email = `telegram-review-${Date.now()}@uzdonate.dev`;
    const user = await app.prisma.user.create({
      data: {
        id: userId,
        publicId: `TR${Date.now().toString(36)}`.slice(0, 20),
        email,
        passwordHash: 'test-hash',
        locale: 'uz',
        emailVerifiedAt: new Date(),
        wallet: { create: {} },
      },
    });
    const topUp = await app.prisma.topUpRequest.create({
      data: {
        userId: user.id,
        amountMinor: 5_000_000,
        type: 'PAYNET_TERMINAL',
        channel: 'BANKOMAT',
        status: 'EXPIRED',
        userReference: 'Telegram chek #88',
        userConfirmedPaidAt: new Date(),
      },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: true }), { status: 200 },
    ));

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/telegram/topup-review-webhook',
        headers: { 'x-telegram-bot-api-secret-token': 'isolated-review-webhook-secret-32-bytes' },
        payload: {
          update_id: 3,
          callback_query: {
            id: 'approve-callback',
            from: { id: 123456789 },
            data: `topup:approve:${topUp.id}`,
            message: {
              message_id: 88,
              chat: { id: 123456789, type: 'private' },
              caption: 'Bankomat cheki',
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect((await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: topUp.id } })).status).toBe('VERIFIED');
      expect((await app.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceMinor).toBe(5_000_000);
      expect(await app.prisma.walletTransaction.count({ where: { idempotencyKey: `topup:${topUp.id}` } })).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
      await app.prisma.auditLog.deleteMany({ where: { entityId: topUp.id } });
      await app.prisma.notification.deleteMany({ where: { userId: user.id } });
      await app.prisma.walletTransaction.deleteMany({ where: { wallet: { userId: user.id } } });
      await app.prisma.topUpRequest.delete({ where: { id: topUp.id } });
      await app.prisma.wallet.delete({ where: { userId: user.id } });
      await app.prisma.user.delete({ where: { id: user.id } });
    }
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
