import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateOrderNumber } from '../src/lib/order-number.js';
import {
  createOrder,
  fulfillPaidOrder,
  refundOrderToWallet,
  retryFulfillment,
} from '../src/modules/orders/orders.service.js';
import { ConflictError } from '../src/lib/errors.js';

// The actual purchase pipeline (createOrder -> fulfillPaidOrder ->
// retry/refund) had zero test coverage despite being the code that charges
// customers and triggers real fulfillment — this exercises it against a
// live database and the real DEV_MOCK_TOPUP provider adapter, not stubs.

const prisma = new PrismaClient();
const ctx = { prisma };

let gameId: string;
let productId: string;
const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

/**
 * MockTopupProvider's validatePlayer() rejects the same "ends in 000" player
 * ids that createTopup() does, so createOrder() itself never lets one
 * through — there's no way to reach a PENDING order with a fulfillment-time
 * failure via the public service function alone. Building the row directly
 * models the real scenario this exercises: a player id that was valid at
 * checkout but fails when fulfillment actually runs (account changes,
 * timing, a provider-side hiccup) — fulfillPaidOrder()'s job either way.
 */
async function createRawPendingOrder(userId: string, playerId: string, amountMinor: number) {
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId,
      gameId,
      playerId,
      amountMinor,
      status: 'PENDING',
      idempotencyKey: `vitest-raw-${userId}-${playerId}`,
      items: {
        create: {
          productId,
          productName: 'Vitest Orders Flow Product',
          quantity: 1,
          unitAmountMinor: amountMinor,
          totalAmountMinor: amountMinor,
        },
      },
    },
  });
  return order;
}

async function makeUser(discountPercent = 0) {
  const user = await prisma.user.create({
    data: {
      publicId: `OPF${Date.now().toString(36)}${createdUserIds.length}`.slice(0, 20).toUpperCase(),
      email: `vitest-orders-flow-${Date.now()}-${createdUserIds.length}@uzdonate.dev`,
      passwordHash: 'x',
      locale: 'uz',
      emailVerifiedAt: new Date(),
      discountPercent,
      wallet: { create: {} },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe('order purchase pipeline (live DB)', () => {
  beforeAll(async () => {
    const game = await prisma.game.create({
      data: {
        slug: `vitest-orders-flow-${Date.now()}`,
        name: 'Vitest Orders Flow Game',
        availability: 'ACTIVE',
      },
    });
    gameId = game.id;

    const product = await prisma.product.create({
      data: {
        gameId,
        name: 'Vitest Orders Flow Product',
        amountMinor: 50_000_00,
        costMinor: 30_000_00,
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
        providerProductCode: 'VITEST_ORDERS_FLOW_SKU',
        priority: 0,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.providerAttempt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
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

  it('charges the discounted amount for a reseller and snapshots it onto the order', async () => {
    const user = await makeUser(20);
    const order = await createOrder(ctx, user.id, {
      gameId,
      productId,
      playerId: 'player-with-discount',
      idempotencyKey: `vitest-order-discount-${user.id}`,
    });
    createdOrderIds.push(order.id);

    // 20% off 50 000,00 -> 40 000,00.
    expect(order.amountMinor).toBe(40_000_00);
    expect(order.discountPercent).toBe(20);
    expect(order.status).toBe('PENDING');
  });

  it('returns the same order on a retried idempotency key instead of creating a second one', async () => {
    const user = await makeUser();
    const idempotencyKey = `vitest-order-idempotent-${user.id}`;

    const first = await createOrder(ctx, user.id, {
      gameId,
      productId,
      playerId: 'player-idempotent',
      idempotencyKey,
    });
    createdOrderIds.push(first.id);

    const second = await createOrder(ctx, user.id, {
      gameId,
      productId,
      playerId: 'player-idempotent',
      idempotencyKey,
    });

    expect(second.id).toBe(first.id);
    const count = await prisma.order.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });

  it('refuses to hand a different user the first user\'s order for a colliding idempotency key', async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    const idempotencyKey = `vitest-order-collision-${userA.id}`;

    const order = await createOrder(ctx, userA.id, {
      gameId,
      productId,
      playerId: 'player-collision',
      idempotencyKey,
    });
    createdOrderIds.push(order.id);

    await expect(
      createOrder(ctx, userB.id, {
        gameId,
        productId,
        playerId: 'player-collision-b',
        idempotencyKey,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('runs a successful order all the way to COMPLETED via the real fulfillment adapter', async () => {
    const user = await makeUser();
    const order = await createOrder(ctx, user.id, {
      gameId,
      productId,
      playerId: 'good-player-id',
      idempotencyKey: `vitest-order-success-${user.id}`,
    });
    createdOrderIds.push(order.id);

    await fulfillPaidOrder(ctx, order.id);

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe('COMPLETED');
    expect(finalOrder.paidAt).not.toBeNull();
    expect(finalOrder.completedAt).not.toBeNull();

    const attempts = await prisma.providerAttempt.findMany({ where: { orderId: order.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe('SUCCESS');

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((h) => h.toStatus)).toEqual(['PENDING', 'PAID', 'PROCESSING', 'COMPLETED']);
  });

  it('marks the order FAILED with a reason when the provider rejects the player id', async () => {
    const user = await makeUser();
    // MockTopupProvider treats any player id ending "000" as invalid.
    const order = await createRawPendingOrder(user.id, 'bad-player-000', 50_000_00);
    createdOrderIds.push(order.id);

    await fulfillPaidOrder(ctx, order.id);

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(finalOrder.status).toBe('FAILED');
    expect(finalOrder.failureReason).toBeTruthy();

    const attempts = await prisma.providerAttempt.findMany({ where: { orderId: order.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe('FAILED');
  });

  it('retryFulfillment records a second attempt without corrupting order state', async () => {
    const user = await makeUser();
    const order = await createRawPendingOrder(user.id, 'bad-player-000', 50_000_00);
    createdOrderIds.push(order.id);

    await fulfillPaidOrder(ctx, order.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FAILED');

    await retryFulfillment(ctx, order.id);

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    // Same bad player id deterministically fails again on retry — this
    // proves the retry mechanism itself (state transitions, attempt
    // counting) works correctly, not that a bad player id becomes valid.
    expect(finalOrder.status).toBe('FAILED');

    const attempts = await prisma.providerAttempt.findMany({
      where: { orderId: order.id },
      orderBy: { attemptNumber: 'asc' },
    });
    expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
  });

  it('refunds a completed order to the wallet exactly once, blocking a second refund at the state-machine level', async () => {
    const user = await makeUser();
    const order = await createOrder(ctx, user.id, {
      gameId,
      productId,
      playerId: 'refund-good-player',
      idempotencyKey: `vitest-order-refund-${user.id}`,
    });
    createdOrderIds.push(order.id);
    await fulfillPaidOrder(ctx, order.id);

    const admin = await prisma.adminUser.findFirstOrThrow();
    await refundOrderToWallet(ctx, admin.id, order.id, 'test refund');

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(order.amountMinor);

    const refunded = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refunded.status).toBe('REFUNDED');

    // REFUNDED has no allowed outgoing transitions — a second refund attempt
    // must fail before it ever touches the wallet again.
    await expect(refundOrderToWallet(ctx, admin.id, order.id, 'second attempt')).rejects.toThrow(
      'Invalid order status transition',
    );

    const walletAfterSecondAttempt = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(walletAfterSecondAttempt.balanceMinor).toBe(order.amountMinor);
  });
});
