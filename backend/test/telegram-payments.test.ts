import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { checkStarsCheckout, createStarsInvoice, settleStarsPayment } from '../src/modules/telegram/telegram-payments.js';
import { createOrder, refundOrderToWallet } from '../src/modules/orders/orders.service.js';
import { telegramApi } from '../src/modules/telegram/telegram-api.js';
import { payWithWallet } from '../src/modules/payments/payments.service.js';

vi.mock('../src/modules/telegram/telegram-api.js', () => ({ telegramApi: vi.fn(async () => 'https://t.me/$test-invoice'), TelegramApiError: class extends Error {} }));
const prisma = new PrismaClient();
const ctx = { prisma };
const telegramId = String(Math.floor(Math.random() * 1e12) + 1);
let userId: string; let gameId: string; let productId: string;
const orderIds: string[] = [];

describe('Telegram Stars settlement (live DB, mocked Telegram network)', () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { telegramId, publicId: `TG${randomUUID().slice(0, 12)}`, displayName: 'Telegram test', wallet: { create: {} } } });
    userId = user.id;
    const game = await prisma.game.create({ data: { slug: `stars-${randomUUID()}`, name: 'Stars Test', availability: 'ACTIVE' } });
    gameId = game.id;
    const product = await prisma.product.create({ data: { gameId, name: '100 diamonds', amountMinor: 1000000, starsPrice: 50, isTest: true } });
    productId = product.id;
    const provider = await prisma.provider.findUniqueOrThrow({ where: { code: 'DEV_MOCK_TOPUP' } });
    await prisma.providerProduct.create({ data: { providerId: provider.id, productId, providerProductCode: 'STARS_TEST' } });
  });
  afterAll(async () => {
    await prisma.providerAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.$disconnect();
  });
  async function invoice() {
    const order = await createOrder(ctx, userId, { gameId, productId, playerId: '123456789', idempotencyKey: randomUUID() }, 'telegram');
    orderIds.push(order.id);
    await createStarsInvoice(ctx, userId, order.id);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey: `telegram:${order.id}` } });
    return { order, payment, input: { currency: 'XTR', total_amount: 50, invoice_payload: payment.id, telegram_payment_charge_id: `charge-${randomUUID()}` } };
  }
  it('stores Stars separately from UZS and uses the price configured in admin', async () => {
    const { order, payment } = await invoice();
    expect(order.currency).toBe('XTR'); expect(order.amountMinor).toBe(5000);
    expect(payment.checkoutUrl).toBe('https://t.me/$test-invoice');
    await expect(payWithWallet(ctx, userId, order.id, randomUUID())).rejects.toThrow();
  });
  it('rejects wrong payer, amount and currency before confirming checkout', async () => {
    const { input } = await invoice();
    await expect(checkStarsCheckout(ctx, Number(telegramId), input)).resolves.toBeUndefined();
    await expect(checkStarsCheckout(ctx, Number(telegramId) + 1, input)).rejects.toThrow();
    await expect(checkStarsCheckout(ctx, Number(telegramId), { ...input, total_amount: 1 })).rejects.toThrow();
    await expect(checkStarsCheckout(ctx, Number(telegramId), { ...input, currency: 'UZS' })).rejects.toThrow();
  });
  it('duplicate and concurrent successful updates deliver only once', async () => {
    const { input, order } = await invoice();
    await Promise.all([settleStarsPayment(ctx, Number(telegramId), input), settleStarsPayment(ctx, Number(telegramId), input)]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('COMPLETED');
    expect(await prisma.providerAttempt.count({ where: { orderId: order.id } })).toBe(1);
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceMinor).toBe(0);
    await expect(settleStarsPayment(ctx, Number(telegramId), { ...input, telegram_payment_charge_id: 'different-charge' })).rejects.toThrow();
  });
  it('Stars refunds return to Telegram, never crediting the UZS wallet', async () => {
    const { input, order } = await invoice();
    await settleStarsPayment(ctx, Number(telegramId), input);
    await refundOrderToWallet(ctx, 'test-admin', order.id, 'Test refund');
    expect(telegramApi).toHaveBeenCalledWith('refundStarPayment', { user_id: Number(telegramId), telegram_payment_charge_id: input.telegram_payment_charge_id });
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceMinor).toBe(0);
  });
});
