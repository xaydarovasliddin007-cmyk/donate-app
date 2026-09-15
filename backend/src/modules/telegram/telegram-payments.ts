import type { PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { fulfillPaidOrder } from '../orders/orders.service.js';
import { telegramApi } from './telegram-api.js';
import { getTopupProvider } from '../../providers/registry.js';
import { isProduction } from '../../config/env.js';

interface Context { prisma: PrismaClient }

export async function createStarsInvoice(ctx: Context, userId: string, orderId: string) {
  const order = await ctx.prisma.order.findUnique({
    where: { id: orderId }, include: { user: true, items: true, game: true },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.userId !== userId || !order.user.telegramId) throw new ForbiddenError();
  if (order.currency !== 'XTR' || order.status !== 'PENDING') throw new ConflictError('Order is not payable with Stars');
  const provider = await ctx.prisma.provider.upsert({
    where: { code: 'TELEGRAM_STARS' }, update: {},
    create: { code: 'TELEGRAM_STARS', name: 'Telegram Stars', type: 'PAYMENT', isActive: true },
  });
  if (!provider.isActive) throw new ConflictError('Telegram payments are temporarily paused');
  const payment = await ctx.prisma.payment.upsert({
    where: { idempotencyKey: `telegram:${order.id}` }, update: {},
    create: { orderId, providerId: provider.id, amountMinor: order.amountMinor, currency: 'XTR', idempotencyKey: `telegram:${order.id}` },
  });
  if (payment.status !== 'PENDING') throw new ConflictError('Payment already processed');
  if (payment.checkoutUrl) return { invoiceUrl: payment.checkoutUrl, orderId };
  const invoiceUrl = await telegramApi<string>('createInvoiceLink', {
    title: order.game.name.slice(0, 32),
    description: `${order.items[0]?.productName ?? order.game.name} | ID: ${order.playerId}`.slice(0, 255),
    payload: payment.id, provider_token: '', currency: 'XTR',
    prices: [{ label: order.items[0]?.productName ?? order.game.name, amount: order.amountMinor / 100 }],
  });
  await ctx.prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl: invoiceUrl } });
  return { invoiceUrl, orderId };
}

export interface StarsPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
}

async function verifiedPayment(ctx: Context, telegramId: number, input: Omit<StarsPayment, 'telegram_payment_charge_id'>) {
  const payment = await ctx.prisma.payment.findUnique({
    where: { id: input.invoice_payload }, include: { order: { include: { user: true } } },
  });
  if (!payment || payment.currency !== 'XTR' || input.currency !== 'XTR' ||
      payment.amountMinor !== input.total_amount * 100 || payment.order.user.telegramId !== String(telegramId)) {
    throw new ValidationError('Payment details do not match the order');
  }
  return payment;
}

export async function checkStarsCheckout(ctx: Context, telegramId: number, input: Omit<StarsPayment, 'telegram_payment_charge_id'>) {
  const payment = await verifiedPayment(ctx, telegramId, input);
  if (payment.order.user.status !== 'ACTIVE' || payment.status !== 'PENDING' || payment.order.status !== 'PENDING') {
    throw new ConflictError('This order is no longer payable');
  }
  const provider = await ctx.prisma.provider.findUnique({ where: { code: 'TELEGRAM_STARS' } });
  if (!provider?.isActive) throw new ConflictError('Payments are paused');
  const item = await ctx.prisma.orderItem.findFirst({ where: { orderId: payment.orderId }, include: { product: { include: { game: true } } } });
  if (!item?.product.isActive || (isProduction && item.product.isTest) || item.product.game.availability !== 'ACTIVE') {
    throw new ConflictError('Product is no longer available');
  }
  const fulfillment = await ctx.prisma.providerProduct.findFirst({
    where: { productId: item.productId, isActive: true, provider: { isActive: true, type: 'TOPUP' } },
    include: { provider: true }, orderBy: { priority: 'asc' },
  });
  if (!fulfillment) throw new ConflictError('Delivery is temporarily unavailable');
  getTopupProvider(fulfillment.provider.code);
}

export async function settleStarsPayment(ctx: Context, telegramId: number, input: StarsPayment) {
  const payment = await verifiedPayment(ctx, telegramId, input);
  if (payment.telegramChargeId && payment.telegramChargeId !== input.telegram_payment_charge_id) {
    throw new ConflictError('A different charge is already recorded for this invoice');
  }
  // Commit settlement before fulfillment so a retried update can recover a crash.
  await ctx.prisma.$transaction(async (tx) => {
    const changed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'SUCCEEDED', telegramChargeId: input.telegram_payment_charge_id },
    });
    if (changed.count) {
      await tx.paymentAttempt.create({ data: {
        paymentId: payment.id, status: 'SUCCEEDED', providerRef: input.telegram_payment_charge_id,
      } });
    }
  });
  const settled = await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (settled.status === 'SUCCEEDED' && settled.telegramChargeId === input.telegram_payment_charge_id) {
    await fulfillPaidOrder(ctx, payment.orderId);
  }
}
