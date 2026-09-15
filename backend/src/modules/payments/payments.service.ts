import { Prisma, type Payment, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError, NotFoundError, ServiceUnavailableError } from '../../lib/errors.js';
import { isProduction } from '../../config/env.js';
import { formatMinorAmount } from '../../lib/money.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { fulfillPaidOrder, markOrderPaymentFailed } from '../orders/orders.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getPaymentProvider } from '../../providers/registry.js';
import { InsufficientBalanceError, debitOrderWallet } from '../wallet/wallet.service.js';
import type { CreatePaymentInput } from './payments.schemas.js';

interface PaymentContext {
  prisma: PrismaClient;
}

function toPublicPayment(payment: Payment & { attempts?: { status: string; createdAt: Date }[] }) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    // Dev/test provider never redirects anywhere — the client is expected to
    // use the simulate-webhook endpoint instead. A real adapter would set this.
    checkoutUrl: payment.checkoutUrl ?? null,
    devSimulateAvailable: !isProduction,
    createdAt: payment.createdAt,
  };
}

export async function createPayment(ctx: PaymentContext, userId: string, input: CreatePaymentInput) {
  const existing = await ctx.prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { order: true } });
  if (existing) {
    if (existing.order.userId !== userId) throw new ForbiddenError('This payment does not belong to you');
    if (existing.orderId !== input.orderId) {
      throw new ConflictError('Idempotency key already used for a different order');
    }
    return toPublicPayment(existing);
  }

  const order = await ctx.prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  if (order.userId !== userId) {
    throw new ForbiddenError('This order does not belong to you');
  }
  if (order.status !== 'PENDING') {
    throw new ConflictError(`Order is not payable in its current status (${order.status})`);
  }
  if (order.currency !== 'UZS') throw new ConflictError('This order requires its original payment currency');

  const provider = await ctx.prisma.provider.findUnique({ where: { code: input.providerCode } });
  if (!provider || !provider.isActive || provider.type !== 'PAYMENT') {
    throw new ServiceUnavailableError('Selected payment method is currently unavailable');
  }
  const adapter = getPaymentProvider(provider.code);

  const payment = await ctx.prisma.payment.create({
    data: {
      orderId: order.id,
      providerId: provider.id,
      amountMinor: order.amountMinor,
      currency: order.currency,
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey,
    },
  });

  const intent = await adapter.createPaymentIntent({
    referenceId: payment.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    idempotencyKey: input.idempotencyKey,
  });

  await ctx.prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      providerRef: intent.providerRef,
      status: 'INITIATED',
      rawResponse: (intent.raw ?? {}) as Prisma.InputJsonValue,
    },
  });

  const updated = await ctx.prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl: intent.checkoutUrl ?? null } });
  return toPublicPayment(updated);
}

/**
 * Pay for an order directly from the customer's UZDONATE wallet — internal
 * money movement only, so unlike an external provider this settles
 * synchronously: no redirect, no webhook, no PENDING window. `providerId`
 * stays null on the resulting Payment row (nothing external was involved);
 * that's what distinguishes a wallet-paid Payment from a provider-paid one.
 *
 * On insufficient balance, the order is deliberately left PENDING (not
 * failed) — unlike a declined card, "not enough balance" is something the
 * user can fix immediately (top up) and retry, so we don't want to burn
 * the order.
 */
export async function payWithWallet(
  ctx: PaymentContext,
  userId: string,
  orderId: string,
  idempotencyKey: string,
) {
  const result = await ctx.prisma.$transaction(async (tx) => {
    // Serialize payments for one order, including retries with different keys.
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.userId !== userId) throw new ForbiddenError('This order does not belong to you');
    if (order.currency !== 'UZS') throw new ConflictError('This order requires its original payment currency');
    const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.orderId !== orderId || existing.providerId)) throw new ConflictError('Idempotency key already used');
    const settled = await tx.payment.findFirst({ where: { orderId, status: 'SUCCEEDED' } });
    if (settled) return { payment: settled, insufficient: false };
    if (order.status !== 'PENDING') throw new ConflictError('Order is no longer payable');
    const payment = existing ?? await tx.payment.create({ data: {
      orderId, amountMinor: order.amountMinor, currency: order.currency, status: 'PENDING', idempotencyKey,
    } });
    try {
      await debitOrderWallet(tx, { userId, orderId, paymentId: payment.id, amountMinor: order.amountMinor, currency: order.currency });
    } catch (error) {
      if (!(error instanceof InsufficientBalanceError)) throw error;
      const failed = await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      await tx.paymentAttempt.create({ data: { paymentId: payment.id, status: 'FAILED' } });
      return { payment: failed, insufficient: true };
    }
    const succeeded = await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
    await tx.paymentAttempt.create({ data: { paymentId: payment.id, status: 'SUCCEEDED' } });
    return { payment: succeeded, insufficient: false };
  });
  if (result.insufficient) throw new InsufficientBalanceError();
  await fulfillPaidOrder(ctx, orderId);
  return toPublicPayment(result.payment);
}

export async function getPaymentById(ctx: PaymentContext, userId: string, paymentId: string) {
  const payment = await ctx.prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true, attempts: { orderBy: { createdAt: 'desc' } } },
  });
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }
  if (payment.order.userId !== userId) {
    throw new ForbiddenError('This payment does not belong to you');
  }
  return toPublicPayment(payment);
}

/**
 * The single, idempotent entry point for payment provider webhooks — a real
 * provider's HTTP webhook handler and the dev "simulate" endpoint both funnel
 * through this. Uniqueness on (provider, providerEventId) is what actually
 * guarantees an event is never processed twice; everything else here is just
 * consequence.
 */
export async function processPaymentWebhook(
  ctx: PaymentContext,
  params: {
    provider: string;
    providerEventId: string;
    eventType: string;
    paymentId: string;
    outcome: 'SUCCEEDED' | 'FAILED';
  },
): Promise<{ duplicate: boolean }> {
  let webhookEvent;
  try {
    webhookEvent = await ctx.prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        status: 'RECEIVED',
        payload: { paymentId: params.paymentId, outcome: params.outcome } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { duplicate: true };
    }
    throw err;
  }

  const payment = await ctx.prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { order: { select: { userId: true } } },
  });
  if (!payment || payment.status !== 'PENDING') {
    await ctx.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'IGNORED', processedAt: new Date() },
    });
    return { duplicate: false };
  }

  await ctx.prisma.payment.update({ where: { id: payment.id }, data: { status: params.outcome } });
  await ctx.prisma.paymentAttempt.create({
    data: { paymentId: payment.id, status: params.outcome === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED' },
  });

  if (params.outcome === 'SUCCEEDED') {
    notifyAdmins(`💳 <b>Payment succeeded</b> — ${formatMinorAmount(payment.amountMinor, payment.currency)}`);
    await createNotification(ctx, {
      userId: payment.order.userId,
      type: 'PAYMENT_SUCCESS',
      title: 'Payment received',
      body: `Your payment of ${formatMinorAmount(payment.amountMinor, payment.currency)} was received.`,
      deepLink: `/orders/${payment.orderId}`,
    });
    await fulfillPaidOrder(ctx, payment.orderId);
  } else {
    notifyAdmins(`⚠️ <b>Payment failed</b> — ${formatMinorAmount(payment.amountMinor, payment.currency)}`);
    await markOrderPaymentFailed(ctx, payment.orderId, 'Payment failed');
  }

  await ctx.prisma.webhookEvent.update({
    where: { id: webhookEvent.id },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });

  return { duplicate: false };
}

/** Dev/test only — simulates the provider sending a webhook, through the exact same processing path. */
export async function simulateWebhook(
  ctx: PaymentContext,
  userId: string,
  paymentId: string,
  outcome: 'SUCCEEDED' | 'FAILED',
) {
  const payment = await ctx.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }
  if (payment.order.userId !== userId) {
    throw new ForbiddenError('This payment does not belong to you');
  }

  await processPaymentWebhook(ctx, {
    provider: 'DEV_MOCK_PAYMENT',
    providerEventId: `simulate-${randomUUID()}`,
    eventType: outcome === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
    paymentId: payment.id,
    outcome,
  });

  return getPaymentById(ctx, userId, paymentId);
}
