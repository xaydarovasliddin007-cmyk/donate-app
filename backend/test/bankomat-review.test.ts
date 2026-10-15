import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { signAdminAccessToken } from '../src/modules/admin/admin-token.js';
import { rejectTopUpRequest, submitTopUpReceipt, verifyTopUpRequest } from '../src/modules/topup/topup.service.js';

describe('Bankomat receipts and confirmed payment amounts', () => {
  let app: FastifyInstance;
  let adminId: string;
  const userIds: string[] = [];
  const requestIds: string[] = [];
  const originalFetch = globalThis.fetch;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const input = { fileName: 'bankomat.png', mimeType: 'image/png' as const, dataBase64: png.toString('base64') };
  beforeAll(async () => { app = await buildApp(); await app.ready(); adminId = (await app.prisma.adminUser.findFirstOrThrow()).id; });
  beforeEach(() => { globalThis.fetch = originalFetch; });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await app.prisma.auditLog.deleteMany({ where: { entityId: { in: requestIds } } });
    await app.prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await app.prisma.walletTransaction.deleteMany({ where: { topUpRequestId: { in: requestIds } } });
    await app.prisma.topUpRequest.deleteMany({ where: { id: { in: requestIds } } });
    await app.prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await app.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });
  const adminHeaders = (role = 'FINANCE') => ({ authorization: `Bearer ${signAdminAccessToken({ sub: adminId, role, scope: 'admin' })}` });
  async function fixture(manual = true) {
    const user = await app.prisma.user.create({ data: { publicId: `BM-${randomUUID().slice(0, 12)}`, email: `${randomUUID()}@uzdonate.dev`, wallet: { create: {} } } });
    userIds.push(user.id);
    const request = await app.prisma.topUpRequest.create({ data: { userId: user.id, amountMinor: 5_000_000, type: manual ? 'PAYNET_TERMINAL' : 'CARD_TRANSFER', channel: manual ? 'BANKOMAT' : 'HUMO' } });
    requestIds.push(request.id);
    return { user, request, headers: { authorization: `Bearer ${app.jwt.sign({ sub: user.id, role: 'CUSTOMER' })}` } };
  }
  async function assertUncredited(userId: string, requestId: string) {
    expect((await app.prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceMinor).toBe(0);
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: requestId } })).toBe(0);
  }

  it('accepts and privately stores a receipt even when Telegram refuses delivery', async () => {
    const { user, request, headers } = await fixture();
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: 'Forbidden: the bot cannot send messages to a bot' }), { status: 403 }));
    const response = await app.inject({ method: 'POST', url: `/api/v1/topups/${request.id}/receipt`, headers, payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json().receipt.deliveryStatus).toBe('FAILED');
    expect(response.json().userConfirmedPaidAt).toBeTruthy();
    expect(JSON.stringify(response.json())).not.toContain('imageData');
    expect(Buffer.from((await app.prisma.topUpReceipt.findUniqueOrThrow({ where: { topUpRequestId: request.id } })).imageData)).toEqual(png);
    await assertUncredited(user.id, request.id);
    const adminImage = await app.inject({ url: `/api/v1/admin/topups/${request.id}/receipt`, headers: adminHeaders() });
    expect(adminImage.statusCode).toBe(200);
    expect(adminImage.headers['content-type']).toContain('image/png');
    expect(adminImage.headers['cache-control']).toBe('private, no-store');
    expect(adminImage.rawPayload).toEqual(png);
    const rows = await app.inject({ url: '/api/v1/admin/topups?limit=100', headers: adminHeaders() });
    expect(rows.json().topUps.find((item: { id: string }) => item.id === request.id).receipt.fileName).toBe('bankomat.png');
    expect(JSON.stringify(rows.json())).not.toContain('imageData');
  });

  it('protects receipt images from anonymous users, other customers and non-finance admin roles', async () => {
    const first = await fixture(); const second = await fixture();
    await app.prisma.topUpReceipt.create({ data: { topUpRequestId: first.request.id, fileName: 'bankomat.png', mimeType: 'image/png', imageData: png } });
    expect((await app.inject(`/api/v1/topups/${first.request.id}/receipt`)).statusCode).toBe(401);
    expect((await app.inject({ url: `/api/v1/topups/${first.request.id}/receipt`, headers: second.headers })).statusCode).toBe(403);
    expect((await app.inject(`/api/v1/admin/topups/${first.request.id}/receipt`)).statusCode).toBe(401);
    expect((await app.inject({ url: `/api/v1/admin/topups/${first.request.id}/receipt`, headers: adminHeaders('CONTENT_MANAGER') })).statusCode).toBe(403);
  });

  it('deduplicates concurrent receipt uploads and does not notify Telegram twice', async () => {
    const { user, request } = await fixture();
    const telegram = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), { status: 200 }));
    globalThis.fetch = telegram;
    await Promise.all([0, 1].map(() => submitTopUpReceipt({ prisma: app.prisma }, user.id, request.id, input)));
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(await app.prisma.topUpReceipt.count({ where: { topUpRequestId: request.id } })).toBe(1);
    expect((await app.prisma.topUpReceipt.findUniqueOrThrow({ where: { topUpRequestId: request.id } })).deliveryStatus).toBe('SENT');
  });

  it('rejects an invalid image without recording a paid claim', async () => {
    const { user, request, headers } = await fixture();
    const response = await app.inject({ method: 'POST', url: `/api/v1/topups/${request.id}/receipt`, headers, payload: { ...input, dataBase64: Buffer.from('not-an-image-at-all').toString('base64') } });
    expect(response.statusCode).toBe(400);
    expect(await app.prisma.topUpReceipt.count({ where: { topUpRequestId: request.id } })).toBe(0);
    expect((await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: request.id } })).userConfirmedPaidAt).toBeNull();
    await assertUncredited(user.id, request.id);
  });

  it('credits the corrected amount and preserves the requested amount and reason in the audit and ledger', async () => {
    const { user, request } = await fixture();
    const response = await app.inject({ method: 'POST', url: `/api/v1/admin/topups/${request.id}/verify`, headers: adminHeaders(), payload: { amountMinor: 4_800_000, reviewNote: 'Actual cash deposit confirmed on bank statement' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'VERIFIED', amountMinor: 4_800_000 });
    expect((await app.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceMinor).toBe(4_800_000);
    const entry = await app.prisma.walletTransaction.findUniqueOrThrow({ where: { idempotencyKey: `topup:${request.id}` } });
    expect(entry.metadata).toMatchObject({ requestedAmountMinor: 5_000_000, confirmedAmountMinor: 4_800_000 });
    expect((await app.prisma.auditLog.findFirstOrThrow({ where: { entityId: request.id, action: 'topup.verify' } })).metadata).toMatchObject({ requestedAmountMinor: 5_000_000, confirmedAmountMinor: 4_800_000 });
    expect((await app.inject({ method: 'POST', url: `/api/v1/admin/topups/${request.id}/verify`, headers: adminHeaders() })).statusCode).toBe(409);
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: request.id } })).toBe(1);
  });

  it('allows only one of two simultaneous corrected amounts to be credited', async () => {
    const { user, request } = await fixture();
    const results = await Promise.allSettled([4_800_000, 4_950_000].map(amountMinor => verifyTopUpRequest({ prisma: app.prisma }, adminId, request.id, { amountMinor, reviewNote: 'Bank statement checked' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const final = await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect((await app.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceMinor).toBe(final.amountMinor);
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: request.id } })).toBe(1);
    expect(await app.prisma.auditLog.count({ where: { entityId: request.id, action: 'topup.verify' } })).toBe(1);
  });

  it('keeps a concurrent reject and approval consistent with the wallet', async () => {
    const { user, request } = await fixture();
    const results = await Promise.allSettled([
      verifyTopUpRequest({ prisma: app.prisma }, adminId, request.id, { amountMinor: 4_800_000, reviewNote: 'Bank statement checked' }),
      rejectTopUpRequest({ prisma: app.prisma }, adminId, request.id, 'Payment not found'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const final = await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: request.id } });
    const wallet = await app.prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(final.status === 'VERIFIED' ? 4_800_000 : 0);
  });

  it('rolls back the wallet, decision and ledger when the admin audit cannot be saved', async () => {
    const { user, request } = await fixture();
    await expect(verifyTopUpRequest({ prisma: app.prisma }, randomUUID(), request.id)).rejects.toThrow();
    expect((await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('PENDING');
    await assertUncredited(user.id, request.id);
  });

  it('rejects invalid amounts, missing change reasons and changes to automatic card amounts', async () => {
    const { user, request } = await fixture();
    for (const amountMinor of [-1, 0, 1.5, 2_000_000_001]) {
      expect((await app.inject({ method: 'POST', url: `/api/v1/admin/topups/${request.id}/verify`, headers: adminHeaders(), payload: { amountMinor, reviewNote: 'Checked' } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: `/api/v1/admin/topups/${request.id}/verify`, headers: adminHeaders(), payload: { amountMinor: 4_800_000 } })).statusCode).toBe(400);
    await assertUncredited(user.id, request.id);
    const card = await fixture(false);
    await expect(verifyTopUpRequest({ prisma: app.prisma }, adminId, card.request.id, { amountMinor: 4_800_000, reviewNote: 'Checked' })).rejects.toThrow('Only Bankomat');
    await assertUncredited(card.user.id, card.request.id);
  });

  it('exposes only the public review bot name and lets a private sender obtain their own ID without gaining review permission', async () => {
    const calls: { method: string; body: Record<string, unknown> }[] = [];
    globalThis.fetch = vi.fn(async (url, options) => {
      const method = String(url).split('/').pop()!;
      calls.push({ method, body: JSON.parse(String(options?.body)) });
      return new Response(JSON.stringify({ ok: true, result: method === 'getMe' ? { id: 100, username: 'isolated_review_bot' } : true }), { status: 200 });
    });
    const info = await app.inject({ url: '/api/v1/admin/topups/review-bot', headers: adminHeaders() });
    expect(info.json()).toEqual({ username: 'isolated_review_bot' });
    expect((await app.inject('/api/v1/admin/topups/review-bot')).statusCode).toBe(401);
    const setup = await app.inject({ method: 'POST', url: '/api/v1/telegram/topup-review-webhook', headers: { 'x-telegram-bot-api-secret-token': 'isolated-review-webhook-secret-32-bytes' }, payload: { update_id: 101, message: { from: { id: 7654321 }, chat: { id: 7654321, type: 'private' }, text: '/id' } } });
    expect(setup.statusCode).toBe(200);
    expect(calls.find(call => call.method === 'sendMessage')?.body).toMatchObject({ chat_id: 7654321 });
    expect(calls.find(call => call.method === 'sendMessage')?.body.text).toContain('7654321');
    expect(calls.filter(call => call.method === 'sendMessage')).toHaveLength(1);
    const request = await fixture();
    await app.inject({ method: 'POST', url: '/api/v1/telegram/topup-review-webhook', headers: { 'x-telegram-bot-api-secret-token': 'isolated-review-webhook-secret-32-bytes' }, payload: { update_id: 102, callback_query: { id: 'unauthorized-approval', from: { id: 7654321 }, data: `topup:approve:${request.request.id}`, message: { message_id: 1, chat: { id: 7654321, type: 'private' } } } } });
    await assertUncredited(request.user.id, request.request.id);
  });
});
