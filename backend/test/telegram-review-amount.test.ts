import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { parseReviewAmount } from '../src/modules/telegram/topup-review-flow.js';
import { rejectTopUpRequest } from '../src/modules/topup/topup.service.js';

describe('Telegram Bankomat actual amount review', () => {
  let app: FastifyInstance;
  const users: string[] = [];
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  let messageId = 100;
  const chat = { id: 123456789, type: 'private' };
  const headers = { 'x-telegram-bot-api-secret-token': 'isolated-review-webhook-secret-32-bytes' };
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = vi.fn(async (url, options) => {
      const method = String(url).split('/').pop()!;
      calls.push({ method, body: JSON.parse(String(options?.body)) });
      return new Response(JSON.stringify({ ok: true, result: method === 'sendMessage' ? { message_id: ++messageId } : true }), { status: 200 });
    });
  });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await app.prisma.auditLog.deleteMany({ where: { entityId: { in: requests } } });
    await app.prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.walletTransaction.deleteMany({ where: { topUpRequestId: { in: requests } } });
    await app.prisma.topUpRequest.deleteMany({ where: { id: { in: requests } } });
    await app.prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });
  async function fixture() {
    const user = await app.prisma.user.create({ data: { publicId: `TA-${randomUUID().slice(0, 12)}`, wallet: { create: {} } } });
    users.push(user.id);
    const request = await app.prisma.topUpRequest.create({ data: { userId: user.id, amountMinor: 5_000_000, type: 'PAYNET_TERMINAL', channel: 'BANKOMAT', status: 'EXPIRED' } });
    requests.push(request.id);
    return { user, request };
  }
  function callback(data: string, id = randomUUID(), originMessageId = 88, sender = chat.id, callbackChat = chat) {
    return app.inject({ method: 'POST', url: '/api/v1/telegram/topup-review-webhook', headers,
      payload: { update_id: 1, callback_query: { id, from: { id: sender }, data, message: { message_id: originMessageId, chat: callbackChat, caption: 'Bankomat cheki' } } } });
  }
  function reply(promptMessageId: number, text: string, sender = chat.id) {
    return app.inject({ method: 'POST', url: '/api/v1/telegram/topup-review-webhook', headers,
      payload: { update_id: 2, message: { message_id: ++messageId, from: { id: sender }, chat, text, reply_to_message: { message_id: promptMessageId } } } });
  }
  async function start(requestId: string) {
    expect((await callback(`topup:amount:${requestId}`)).statusCode).toBe(200);
    return app.prisma.telegramTopUpReview.findFirstOrThrow({ where: { topUpRequestId: requestId }, orderBy: { createdAt: 'desc' } });
  }
  async function ready(requestId: string) {
    const draft = await start(requestId);
    await reply(draft.promptMessageId!, '48 000,50');
    const reason = await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } });
    await reply(reason.promptMessageId!, 'Chekdagi haqiqiy summa');
    return app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } });
  }
  async function balance(userId: string) { return (await app.prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceMinor; }

  it('parses exact minor units and rejects zero, negative, overflow, scientific and ambiguous amounts', () => {
    expect(parseReviewAmount('48 000,50')).toBe(4_800_050);
    expect(parseReviewAmount('20000000')).toBe(2_000_000_000);
    for (const text of ['0', '-1', '1.999', '2e5', '20,000,00', '20000000.01', '']) expect(parseReviewAmount(text)).toBeNull();
  });

  it('collects amount and reason without crediting, then commits explicit confirmation exactly once with an audit', async () => {
    const { user, request } = await fixture();
    const draft = await ready(request.id);
    expect(draft.state).toBe('READY');
    expect(draft.amountMinor).toBe(4_800_050);
    expect(await balance(user.id)).toBe(0);
    expect(calls.find(call => String(call.body.text).includes('Balansga qo‘shiladi:'))?.body.reply_markup).toMatchObject({ inline_keyboard: [[{ callback_data: `topup:confirm:${draft.id}` }, { callback_data: `topup:cancel:${draft.id}` }]] });
    expect((await callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId!)).statusCode).toBe(200);
    await callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId!);
    expect(await balance(user.id)).toBe(4_800_050);
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: request.id } })).toBe(1);
    expect((await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } })).state).toBe('APPLIED');
    const audit = await app.prisma.auditLog.findFirstOrThrow({ where: { entityId: request.id, action: 'telegram.topup.verify' } });
    expect(audit.metadata).toMatchObject({ requestedAmountMinor: 5_000_000, confirmedAmountMinor: 4_800_050, reviewNote: 'Chekdagi haqiqiy summa' });
  });

  it('ignores unauthorized senders, group chats and replies to a different prompt', async () => {
    const { user, request } = await fixture();
    await callback(`topup:amount:${request.id}`, randomUUID(), 88, 77);
    await callback(`topup:amount:${request.id}`, randomUUID(), 88, chat.id, { ...chat, type: 'group' });
    expect(await app.prisma.telegramTopUpReview.count({ where: { topUpRequestId: request.id } })).toBe(0);
    const draft = await start(request.id);
    await reply(draft.promptMessageId!, '48000', 77);
    await reply(draft.promptMessageId! + 500, '48000');
    expect((await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } })).state).toBe('AMOUNT');
    expect(await balance(user.id)).toBe(0);
  });

  it('re-prompts for invalid amounts and requires a reason', async () => {
    const { user, request } = await fixture();
    const draft = await start(request.id);
    await reply(draft.promptMessageId!, '-10');
    let current = await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } });
    expect(current.state).toBe('AMOUNT');
    await reply(current.promptMessageId!, '48000');
    current = await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } });
    await reply(current.promptMessageId!, ' ');
    expect((await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } })).state).toBe('REASON');
    expect(await balance(user.id)).toBe(0);
  });

  it('does not credit cancelled, expired, mismatched message or previously rejected reviews', async () => {
    const { user, request } = await fixture();
    const draft = await ready(request.id);
    await callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId! + 1000);
    expect(await balance(user.id)).toBe(0);
    await callback(`topup:cancel:${draft.id}`, randomUUID(), draft.confirmationMessageId!);
    await callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId!);
    expect(await balance(user.id)).toBe(0);
    const second = await ready(request.id);
    await app.prisma.telegramTopUpReview.update({ where: { id: second.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await callback(`topup:confirm:${second.id}`, randomUUID(), second.confirmationMessageId!);
    expect(await balance(user.id)).toBe(0);
    const third = await ready(request.id);
    await rejectTopUpRequest({ prisma: app.prisma }, null, request.id, 'No bank transfer');
    await callback(`topup:confirm:${third.id}`, randomUUID(), third.confirmationMessageId!);
    expect(await balance(user.id)).toBe(0);
  });

  it('deduplicates start callbacks and simultaneous confirmation without double credit', async () => {
    const { user, request } = await fixture();
    const key = randomUUID();
    await callback(`topup:amount:${request.id}`, key);
    await callback(`topup:amount:${request.id}`, key);
    expect(await app.prisma.telegramTopUpReview.count({ where: { triggerCallbackId: key } })).toBe(1);
    const draft = await ready(request.id);
    await Promise.all([0, 1].map(() => callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId!)));
    expect(await balance(user.id)).toBe(4_800_050);
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: request.id } })).toBe(1);
  });

  it('keeps draft, request, wallet and ledger unchanged if the system audit fails', async () => {
    const { user, request } = await fixture();
    const draft = await ready(request.id);
    const originalTransaction = app.prisma.$transaction.bind(app.prisma);
    const spy = vi.spyOn(app.prisma, '$transaction').mockImplementation(((operation: unknown, ...args: unknown[]) => {
      if (typeof operation !== 'function') return originalTransaction(operation as never);
      return originalTransaction(async tx => operation(new Proxy(tx, { get(target, key) { return key === 'auditLog' ? { create: () => { throw new Error('Isolated audit failure'); } } : Reflect.get(target, key); } })), ...args as []);
    }) as typeof app.prisma.$transaction);
    try { await callback(`topup:confirm:${draft.id}`, randomUUID(), draft.confirmationMessageId!); } finally { spy.mockRestore(); }
    expect(await balance(user.id)).toBe(0);
    expect((await app.prisma.topUpRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('EXPIRED');
    expect((await app.prisma.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } })).state).toBe('READY');
    expect(await app.prisma.walletTransaction.count({ where: { topUpRequestId: request.id } })).toBe(0);
  });
});
