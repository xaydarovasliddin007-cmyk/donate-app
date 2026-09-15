import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateOrderNumber } from '../src/lib/order-number.js';
import { createPayment, payWithWallet, processPaymentWebhook } from '../src/modules/payments/payments.service.js';
import { InsufficientBalanceError } from '../src/modules/wallet/wallet.service.js';

// processPaymentWebhook is the single entry point every real payment
// provider funnels through, and payWithWallet moves real balance — both had
// zero test coverage despite being exactly the code a duplicated webhook
// delivery or a flaky client retry would stress. Exercised against a live
// database and the real DEV_MOCK_TOPUP/DEV_MOCK_PAYMENT providers.

const prisma = new PrismaClient();
const ctx = { prisma };

let gameId: string;
let productId: string;
const ORDER_AMOUNT_MINOR = 25_000_00;
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

async function makeUserWithOrder(startingWalletBalanceMinor = 0) {
  const user = await prisma.user.create({
    data: {
      publicId: `PWT${Date.now().toString(36)}${createdUserIds.length}`.slice(0, 20).toUpperCase(),
      email: `vitest-payments-webhook-${Date.now()}-${createdUserIds.length}@uzdonate.dev`,
      passwordHash: 'x',
      locale: 'uz',
      emailVerifiedAt: new Date(),
      wallet: { create: { balanceMinor: startingWalletBalanceMinor } },
    },
  });
  createdUserIds.push(user.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user.id,
      gameId,
      playerId: 'good-player-id',
      amountMinor: ORDER_AMOUNT_MINOR,
      status: 'PENDING',
      idempotencyKey: `vitest-payments-order-${user.id}`,
      items: {
        create: {
          productId,
          productName: 'Vitest Payments Flow Product',
          quantity: 1,
          unitAmountMinor: ORDER_AMOUNT_MINOR,
          totalAmountMinor: ORDER_AMOUNT_MINOR,
        },
      },
    },
  });
  createdOrderIds.push(order.id);

  return { user, order };
}

describe('payment webhook + wallet-pay pipeline (live DB)', () => {
  it('does not reveal another customer payment on idempotency replay', async () => {
    const { user, order } = await makeUserWithOrder();
    const other = await makeUserWithOrder();
    const input = { orderId: order.id, providerCode: 'DEV_MOCK_PAYMENT', idempotencyKey: randomUUID() };
    await createPayment(ctx, user.id, input);
    await expect(createPayment(ctx, other.user.id, input)).rejects.toThrow('does not belong to you');
  });
  beforeAll(async () => {
    const game = await prisma.game.create({
      data: {
        slug: `vitest-payments-flow-${Date.now()}`,
        name: 'Vitest Payments Flow Game',
        availability: 'ACTIVE',
      },
    });
    gameId = game.id;

    const product = await prisma.product.create({
      data: {
        gameId,
        name: 'Vitest Payments Flow Product',
        amountMinor: ORDER_AMOUNT_MINOR,
        isActive: true,
        isTest: true,
      },
    });
    productId = product.id;

    const mockProvider = await prisma.provider.findUniqueOrThrow({ where: { code: 'DEV_MOCK_TOPUP' } });
    await prisma.providerProduct.create({
      data: {
        productId,
        providerId: mockProvider.id,
        providerProductCode: 'VITEST_PAYMENTS_FLOW_SKU',
        priority: 0,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.providerAttempt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.paymentAttempt.deleteMany({ where: { payment: { orderId: { in: createdOrderIds } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.providerProduct.deleteMany({ where: { productId } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: createdUserIds } } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.$disconnect();
  });

  it('createPayment is idempotent on a retried key', async () => {
    const { user, order } = await makeUserWithOrder();
    const idempotencyKey = `vitest-create-payment-${order.id}`;

    const first = await createPayment(ctx, user.id, {
      orderId: order.id,
      providerCode: 'DEV_MOCK_PAYMENT',
      idempotencyKey,
    });
    const second = await createPayment(ctx, user.id, {
      orderId: order.id,
      providerCode: 'DEV_MOCK_PAYMENT',
      idempotencyKey,
    });

    expect(second.id).toBe(first.id);
    const count = await prisma.payment.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });

  it('a SUCCEEDED webhook settles the payment and completes fulfillment through the real adapter', async () => {
    const { user, order } = await makeUserWithOrder();
    const payment = await createPayment(ctx, user.id, {
      orderId: order.id,
      providerCode: 'DEV_MOCK_PAYMENT',
      idempotencyKey: `vitest-webhook-success-payment-${order.id}`,
    });

    const result = await processPaymentWebhook(ctx, {
      provider: 'DEV_MOCK_PAYMENT',
      providerEventId: `vitest-event-${randomUUID()}`,
      eventType: 'payment.succeeded',
      paymentId: payment.id,
      outcome: 'SUCCEEDED',
    });

    expect(result.duplicate).toBe(false);

    const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(finalPayment.status).toBe('SUCCEEDED');

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe('COMPLETED');
  });

  it('processing the same webhook event twice never double-fulfills the order', async () => {
    const { user, order } = await makeUserWithOrder();
    const payment = await createPayment(ctx, user.id, {
      orderId: order.id,
      providerCode: 'DEV_MOCK_PAYMENT',
      idempotencyKey: `vitest-webhook-dup-payment-${order.id}`,
    });
    const providerEventId = `vitest-event-dup-${randomUUID()}`;

    const first = await processPaymentWebhook(ctx, {
      provider: 'DEV_MOCK_PAYMENT',
      providerEventId,
      eventType: 'payment.succeeded',
      paymentId: payment.id,
      outcome: 'SUCCEEDED',
    });
    const second = await processPaymentWebhook(ctx, {
      provider: 'DEV_MOCK_PAYMENT',
      providerEventId,
      eventType: 'payment.succeeded',
      paymentId: payment.id,
      outcome: 'SUCCEEDED',
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    // Exactly one fulfillment attempt — the duplicate delivery must never
    // trigger a second real-money-equivalent provider call.
    const attempts = await prisma.providerAttempt.count({ where: { orderId: order.id } });
    expect(attempts).toBe(1);
  });

  it('a FAILED webhook marks the payment and order failed without touching any wallet', async () => {
    const { user, order } = await makeUserWithOrder();
    const payment = await createPayment(ctx, user.id, {
      orderId: order.id,
      providerCode: 'DEV_MOCK_PAYMENT',
      idempotencyKey: `vitest-webhook-failed-payment-${order.id}`,
    });

    await processPaymentWebhook(ctx, {
      provider: 'DEV_MOCK_PAYMENT',
      providerEventId: `vitest-event-failed-${randomUUID()}`,
      eventType: 'payment.failed',
      paymentId: payment.id,
      outcome: 'FAILED',
    });

    const finalPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(finalPayment.status).toBe('FAILED');

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe('FAILED');

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(0);
  });

  it('payWithWallet debits the exact order amount and completes fulfillment', async () => {
    const { user, order } = await makeUserWithOrder(ORDER_AMOUNT_MINOR + 10_000_00);
    const result = await payWithWallet(ctx, user.id, order.id, `vitest-pay-wallet-${order.id}`);

    expect(result.status).toBe('SUCCEEDED');

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(10_000_00);

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe('COMPLETED');
  });

  it('two concurrent wallet payments with different keys debit only once', async () => {
    const { user, order } = await makeUserWithOrder(ORDER_AMOUNT_MINOR * 3);
    const payments = await Promise.all([
      payWithWallet(ctx, user.id, order.id, `parallel-a:${order.id}`),
      payWithWallet(ctx, user.id, order.id, `parallel-b:${order.id}`),
    ]);
    expect(payments[0].id).toBe(payments[1].id);
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceMinor).toBe(ORDER_AMOUNT_MINOR * 2);
    expect(await prisma.walletTransaction.count({ where: { orderId: order.id, type: 'PURCHASE' } })).toBe(1);
    expect(await prisma.providerAttempt.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('a wallet retry after adding funds can reuse its failed payment key', async () => {
    const { user, order } = await makeUserWithOrder(0);
    const key = `retry-funded:${order.id}`;
    await expect(payWithWallet(ctx, user.id, order.id, key)).rejects.toThrow(InsufficientBalanceError);
    await prisma.wallet.update({ where: { userId: user.id }, data: { balanceMinor: ORDER_AMOUNT_MINOR } });
    const payment = await payWithWallet(ctx, user.id, order.id, key);
    expect(payment.status).toBe('SUCCEEDED');
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).balanceMinor).toBe(0);
  });

  it('payWithWallet on insufficient balance fails the payment, leaves the order PENDING (not FAILED), and touches no balance', async () => {
    const { user, order } = await makeUserWithOrder(1_000_00); // far less than ORDER_AMOUNT_MINOR

    await expect(payWithWallet(ctx, user.id, order.id, `vitest-pay-wallet-insufficient-${order.id}`)).rejects.toThrow(
      InsufficientBalanceError,
    );

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(1_000_00);

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    // Insufficient balance is user-fixable (top up and retry) — the order
    // must NOT be burned to FAILED the way a real declined payment would.
    expect(finalOrder.status).toBe('PENDING');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { idempotencyKey: `vitest-pay-wallet-insufficient-${order.id}` },
    });
    expect(payment.status).toBe('FAILED');
  });
});
