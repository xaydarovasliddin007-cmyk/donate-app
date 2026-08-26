import type { Order, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { generateOrderNumber } from '../../lib/order-number.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { formatMinorAmount } from '../../lib/money.js';
import { getTopupProvider } from '../../providers/registry.js';
import { createNotification } from '../notifications/notifications.service.js';
import { recordPlayerProfileFromOrder } from '../saved-games/saved-games.service.js';
import * as walletService from '../wallet/wallet.service.js';
import { assertTransition } from './order-state-machine.js';
import type { CreateOrderInput, ValidatePlayerInput } from './orders.schemas.js';

interface OrderContext {
  prisma: PrismaClient;
}

function toPublicOrder(
  order: Order & {
    game: { id: string; name: string; slug: string };
    items: { id: string; productName: string; quantity: number; unitAmountMinor: number; totalAmountMinor: number }[];
    payments?: { id: string; status: string; createdAt: Date }[];
    statusHistory?: { fromStatus: string | null; toStatus: string; reason: string | null; createdAt: Date }[];
  },
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    game: order.game,
    playerId: order.playerId,
    serverId: order.serverId,
    amountMinor: order.amountMinor,
    currency: order.currency,
    failureReason: order.failureReason,
    items: order.items,
    latestPayment: order.payments?.[0] ?? null,
    statusHistory: order.statusHistory ?? [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
  };
}

/**
 * The one place allowed to move an order's status — validates the
 * transition and logs it. Takes just the id/status slice (not a full Order)
 * so callers holding a richer shape (e.g. `Order & { items }`) don't need to
 * juggle types when threading the current status through a multi-step flow.
 */
async function transitionOrder(
  ctx: OrderContext,
  order: { id: string; status: OrderStatus },
  toStatus: OrderStatus,
  reason?: string,
): Promise<OrderStatus> {
  assertTransition(order.status, toStatus);

  const data: Prisma.OrderUpdateInput = { status: toStatus };
  if (toStatus === 'PAID') data.paidAt = new Date();
  if (toStatus === 'COMPLETED') data.completedAt = new Date();

  await ctx.prisma.order.update({ where: { id: order.id }, data });
  await ctx.prisma.orderStatusHistory.create({
    data: { orderId: order.id, fromStatus: order.status, toStatus, reason },
  });
  return toStatus;
}

export async function createOrder(ctx: OrderContext, userId: string, input: CreateOrderInput) {
  const existing = await ctx.prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { game: true, items: true },
  });
  if (existing) {
    if (existing.userId !== userId) {
      // A different user's idempotency key colliding is either an attack or
      // a bug on the client — never silently hand back someone else's order.
      throw new ConflictError('Idempotency key already used');
    }
    return toPublicOrder(existing);
  }

  const game = await ctx.prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game || game.availability !== 'ACTIVE') {
    throw new NotFoundError('Game is not available for purchase');
  }

  // Games with a server catalog (see GameServer) require a valid, active
  // server code and only accept products priced for that exact server.
  // Games without one keep working exactly as before this concept existed —
  // serverId stays free text and products keep matching on serverId: null.
  const gameServerCount = await ctx.prisma.gameServer.count({ where: { gameId: game.id } });
  let resolvedGameServerId: string | null = null;
  if (gameServerCount > 0) {
    if (!input.serverId) {
      throw new ValidationError('serverId is required for this game');
    }
    const server = await ctx.prisma.gameServer.findUnique({
      where: { gameId_code: { gameId: game.id, code: input.serverId } },
    });
    if (!server || !server.isActive) {
      throw new ValidationError('Unknown or inactive server for this game');
    }
    resolvedGameServerId = server.id;
  }

  const product = await ctx.prisma.product.findFirst({
    where: { id: input.productId, gameId: input.gameId, isActive: true, serverId: resolvedGameServerId },
  });
  if (!product) {
    throw new NotFoundError('Product not found or unavailable');
  }

  const providerProduct = await ctx.prisma.providerProduct.findFirst({
    where: { productId: product.id, isActive: true, provider: { isActive: true, type: 'TOPUP' } },
    orderBy: { priority: 'asc' },
    include: { provider: true },
  });
  if (!providerProduct) {
    throw new NotFoundError('No fulfillment provider is currently configured for this product');
  }

  const adapter = getTopupProvider(providerProduct.provider.code);
  const validation = await adapter.validatePlayer({
    providerProductCode: providerProduct.providerProductCode,
    playerId: input.playerId,
    serverId: input.serverId,
  });
  if (!validation.valid) {
    throw new ConflictError(validation.reason ?? 'Player ID could not be validated');
  }

  const order = await ctx.prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        gameId: game.id,
        playerId: input.playerId,
        serverId: input.serverId,
        amountMinor: product.amountMinor,
        currency: product.currency,
        status: 'PENDING',
        idempotencyKey: input.idempotencyKey,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitAmountMinor: product.amountMinor,
            totalAmountMinor: product.amountMinor,
          },
        },
      },
      include: { game: true, items: true },
    });

    await tx.orderStatusHistory.create({
      data: { orderId: created.id, fromStatus: null, toStatus: 'PENDING', reason: 'Order created' },
    });

    return created;
  });

  // Convenience for next time — never allowed to fail order creation itself.
  await recordPlayerProfileFromOrder(ctx, userId, game.id, input.playerId, input.serverId ?? null);

  notifyAdmins(
    `🆕 <b>New order</b> #${order.orderNumber}\n${game.name} — ${formatMinorAmount(order.amountMinor, order.currency)}`,
  );

  return toPublicOrder(order);
}

/**
 * Pre-checkout "does this player ID exist" check for the purchase flow's
 * Data step. Deliberately read-only — never creates or reserves anything —
 * and uses the exact same game/server/product/provider resolution as
 * createOrder() above so it's checking against the same adapter the real
 * order would use. Callers should treat a thrown error (unknown game/
 * server/product, no provider configured) the same as an inconclusive
 * check rather than a hard block — the real gate is still validatePlayer()
 * inside createOrder() itself, this is advisory UI feedback only.
 */
export async function validatePlayer(ctx: OrderContext, input: ValidatePlayerInput) {
  const game = await ctx.prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game || game.availability !== 'ACTIVE') {
    throw new NotFoundError('Game is not available for purchase');
  }

  const gameServerCount = await ctx.prisma.gameServer.count({ where: { gameId: game.id } });
  let resolvedGameServerId: string | null = null;
  if (gameServerCount > 0) {
    if (!input.serverId) {
      throw new ValidationError('serverId is required for this game');
    }
    const server = await ctx.prisma.gameServer.findUnique({
      where: { gameId_code: { gameId: game.id, code: input.serverId } },
    });
    if (!server || !server.isActive) {
      throw new ValidationError('Unknown or inactive server for this game');
    }
    resolvedGameServerId = server.id;
  }

  const product = await ctx.prisma.product.findFirst({
    where: { id: input.productId, gameId: input.gameId, isActive: true, serverId: resolvedGameServerId },
  });
  if (!product) {
    throw new NotFoundError('Product not found or unavailable');
  }

  const providerProduct = await ctx.prisma.providerProduct.findFirst({
    where: { productId: product.id, isActive: true, provider: { isActive: true, type: 'TOPUP' } },
    orderBy: { priority: 'asc' },
    include: { provider: true },
  });
  if (!providerProduct) {
    throw new NotFoundError('No fulfillment provider is currently configured for this product');
  }

  const adapter = getTopupProvider(providerProduct.provider.code);
  return adapter.validatePlayer({
    providerProductCode: providerProduct.providerProductCode,
    playerId: input.playerId,
    serverId: input.serverId,
  });
}

export async function listOrders(ctx: OrderContext, userId: string, limit: number) {
  const orders = await ctx.prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      game: { select: { id: true, name: true, slug: true } },
      items: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return orders.map(toPublicOrder);
}

export async function getOrderById(ctx: OrderContext, userId: string, orderId: string) {
  const order = await ctx.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      game: { select: { id: true, name: true, slug: true } },
      items: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  if (order.userId !== userId) {
    throw new ForbiddenError('This order does not belong to you');
  }
  return toPublicOrder(order);
}

/**
 * Runs the full paid -> fulfilled pipeline for an order. Called by the
 * payments module once a payment webhook confirms funds were captured —
 * never called directly from a customer-facing route.
 */
export async function fulfillPaidOrder(ctx: OrderContext, orderId: string): Promise<void> {
  const order = await ctx.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  let status = await transitionOrder(ctx, { id: order.id, status: order.status }, 'PAID', 'Payment confirmed');
  status = await transitionOrder(ctx, { id: order.id, status }, 'PROCESSING', 'Fulfillment started');

  const item = order.items[0];
  if (!item) {
    await transitionOrder(ctx, { id: order.id, status }, 'FAILED', 'Order has no line items');
    return;
  }

  const providerProduct = await ctx.prisma.providerProduct.findFirst({
    where: { productId: item.productId, isActive: true, provider: { isActive: true, type: 'TOPUP' } },
    orderBy: { priority: 'asc' },
    include: { provider: true },
  });

  if (!providerProduct) {
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { failureReason: 'No active fulfillment provider configured' },
    });
    await transitionOrder(ctx, { id: order.id, status }, 'FAILED', 'No active fulfillment provider configured');
    return;
  }

  await runFulfillmentAttempt(
    ctx,
    { id: order.id, orderNumber: order.orderNumber, userId: order.userId, status, playerId: order.playerId, serverId: order.serverId },
    providerProduct,
  );
}

/** Re-attempts fulfillment for an order stuck in FAILED. Admin-only — see modules/admin. */
export async function retryFulfillment(ctx: OrderContext, orderId: string): Promise<void> {
  const order = await ctx.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  const item = order.items[0];
  if (!item) {
    throw new ConflictError('Order has no line items to fulfill');
  }

  const providerProduct = await ctx.prisma.providerProduct.findFirst({
    where: { productId: item.productId, isActive: true, provider: { isActive: true, type: 'TOPUP' } },
    orderBy: { priority: 'asc' },
    include: { provider: true },
  });
  if (!providerProduct) {
    throw new ConflictError('No active fulfillment provider configured for this product');
  }

  const status = await transitionOrder(
    ctx,
    { id: order.id, status: order.status },
    'PROCESSING',
    'Fulfillment retried by admin',
  );
  await runFulfillmentAttempt(
    ctx,
    { id: order.id, orderNumber: order.orderNumber, userId: order.userId, status, playerId: order.playerId, serverId: order.serverId },
    providerProduct,
  );
}

async function runFulfillmentAttempt(
  ctx: OrderContext,
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    playerId: string;
    serverId: string | null;
  },
  providerProduct: { providerId: string; providerProductCode: string; provider: { code: string } },
): Promise<void> {
  const adapter = getTopupProvider(providerProduct.provider.code);
  const attemptNumber =
    (await ctx.prisma.providerAttempt.count({ where: { orderId: order.id } })) + 1;

  const result = await adapter.createTopup({
    providerProductCode: providerProduct.providerProductCode,
    playerId: order.playerId,
    serverId: order.serverId ?? undefined,
    referenceId: order.id,
  });

  await ctx.prisma.providerAttempt.create({
    data: {
      orderId: order.id,
      providerId: providerProduct.providerId,
      providerProductCode: providerProduct.providerProductCode,
      attemptNumber,
      status: result.success ? 'SUCCESS' : 'FAILED',
      providerTransactionId: result.providerTransactionId,
      responsePayload: (result.raw ?? {}) as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  if (result.success) {
    await transitionOrder(ctx, order, 'COMPLETED', 'Fulfillment succeeded');
    notifyAdmins(`✅ <b>Order completed</b> #${order.orderNumber}`);
    await createNotification(ctx, {
      userId: order.userId,
      type: 'ORDER_SUCCESS',
      title: 'Top-up completed',
      body: `Order #${order.orderNumber} was delivered successfully.`,
      deepLink: `/orders/${order.id}`,
    });
  } else {
    const reason = result.reason ?? 'Fulfillment failed';
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { failureReason: reason },
    });
    await transitionOrder(ctx, order, 'FAILED', reason);
    notifyAdmins(`❌ <b>Order failed</b> #${order.orderNumber}\nReason: ${reason}`);
    await createNotification(ctx, {
      userId: order.userId,
      type: 'ORDER_FAILED',
      title: 'Order failed',
      body: `Order #${order.orderNumber} could not be completed. We'll help sort it out.`,
      deepLink: `/orders/${order.id}`,
    });
  }
}

/**
 * Refunds an order back to the customer's UZDONATE wallet — the only refund
 * destination currently implementable (reversing the original external
 * payment provider would need real provider APIs we don't have credentials
 * for). Order status machine already permits PAID/COMPLETED -> REFUNDED.
 * Admin-only — see modules/admin.
 */
export async function refundOrderToWallet(
  ctx: OrderContext,
  adminId: string,
  orderId: string,
  reason?: string,
): Promise<Order> {
  const order = await ctx.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  await transitionOrder(ctx, order, 'REFUNDED', reason ?? 'Refunded by admin');

  await walletService.creditWallet(ctx, {
    userId: order.userId,
    type: 'REFUND',
    amountMinor: order.amountMinor,
    // Deterministic on the order — retrying this admin action never double-credits.
    idempotencyKey: `refund:${order.id}`,
    reference: `Refund for order ${order.orderNumber}`,
    orderId: order.id,
    createdByAdminId: adminId,
    reason,
  });

  notifyAdmins(
    `↩️ <b>Refund issued</b> #${order.orderNumber} — ${formatMinorAmount(order.amountMinor, order.currency)}`,
  );
  await createNotification(ctx, {
    userId: order.userId,
    type: 'REFUND',
    title: 'Refund credited',
    body: `${formatMinorAmount(order.amountMinor, order.currency)} was refunded to your UZDONATE wallet for order #${order.orderNumber}.`,
    deepLink: `/orders/${order.id}`,
  });

  return ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Marks a still-PENDING order FAILED when its payment fails before ever succeeding. */
export async function markOrderPaymentFailed(ctx: OrderContext, orderId: string, reason: string): Promise<void> {
  const order = await ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== 'PENDING') return;
  await ctx.prisma.order.update({ where: { id: order.id }, data: { failureReason: reason } });
  await transitionOrder(ctx, order, 'FAILED', reason);
}
