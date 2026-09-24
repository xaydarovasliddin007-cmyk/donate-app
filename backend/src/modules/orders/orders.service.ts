import type { Order, OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { isProduction } from '../../config/env.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { generateOrderNumber } from '../../lib/order-number.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { applyDiscount, formatMinorAmount } from '../../lib/money.js';
import { getTopupProvider } from '../../providers/registry.js';
import { createNotification } from '../notifications/notifications.service.js';
import { recordPlayerProfileFromOrder } from '../saved-games/saved-games.service.js';
import * as walletService from '../wallet/wallet.service.js';
import { assertTransition } from './order-state-machine.js';
import type { CreateOrderInput, ValidatePlayerInput } from './orders.schemas.js';
import { telegramApi, TelegramApiError } from '../telegram/telegram-api.js';
import { listFulfillmentCandidates, type FulfillmentCandidate } from './provider-router.js';

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
    zoneId: order.zoneId,
    amountMinor: order.amountMinor,
    currency: order.currency,
    discountPercent: order.discountPercent,
    failureReason: order.failureReason,
    // Explicitly whitelisted, not a bare spread — upstream queries fetch
    // full OrderItem rows (include, not select), and costMinorSnapshot is
    // internal margin data that must never reach a customer-facing response.
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor,
      totalAmountMinor: item.totalAmountMinor,
    })),
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
  ctx: { prisma: PrismaClient | Prisma.TransactionClient },
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

export async function createOrder(ctx: OrderContext, userId: string, input: CreateOrderInput, channel: 'app' | 'telegram' = 'app') {
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
    where: {
      id: input.productId,
      gameId: input.gameId,
      isActive: true,
      serverId: resolvedGameServerId,
      ...(isProduction ? { isTest: false } : {}),
    },
  });
  if (!product) {
    throw new NotFoundError('Product not found or unavailable');
  }

  const [providerProduct] = await listFulfillmentCandidates(ctx.prisma, product.id);
  if (!providerProduct) {
    throw new NotFoundError('No fulfillment provider is currently configured for this product');
  }

  const adapter = getTopupProvider(providerProduct.provider.code);
  const validation = await adapter.validatePlayer({
    providerProductCode: providerProduct.providerProductCode,
    playerId: input.playerId,
    // The adapter's serverId means "real identity", not pricing region —
    // see the zoneId comment on the Order model.
    serverId: input.zoneId,
  });
  if (!validation.valid) {
    throw new ConflictError(validation.reason ?? 'Player ID could not be validated');
  }

  // Reseller/partner accounts get a flat percent off every purchase — set
  // by an admin on the user directly (User.discountPercent), applied here
  // so it's server-authoritative and can never be manipulated from the
  // client.
  const { discountPercent } = await ctx.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { discountPercent: true },
  });
  if (channel === 'telegram' && !product.starsPrice) {
    throw new ValidationError('Telegram Stars price has not been configured for this product');
  }
  const chargedAmountMinor = channel === 'telegram'
    ? Math.max(1, applyDiscount(product.starsPrice!, discountPercent)) * 100
    : applyDiscount(product.amountMinor, discountPercent);

  const order = await ctx.prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        gameId: game.id,
        playerId: input.playerId,
        serverId: input.serverId,
        zoneId: input.zoneId,
        amountMinor: chargedAmountMinor,
        currency: channel === 'telegram' ? 'XTR' : product.currency,
        discountPercent,
        status: 'PENDING',
        idempotencyKey: input.idempotencyKey,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitAmountMinor: chargedAmountMinor,
            totalAmountMinor: chargedAmountMinor,
            // Snapshotted now so a later edit to the product's cost never
            // rewrites this order's already-reported profit — see
            // OrderItem.costMinorSnapshot's doc comment.
            costMinorSnapshot: channel === 'telegram' ? null : product.costMinor,
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
  await recordPlayerProfileFromOrder(ctx, userId, game.id, input.playerId, input.serverId ?? null, input.zoneId ?? null);

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
    where: {
      id: input.productId,
      gameId: input.gameId,
      isActive: true,
      serverId: resolvedGameServerId,
    },
  });
  if (!product) {
    throw new NotFoundError('Product not found or unavailable');
  }

  const [providerProduct] = await listFulfillmentCandidates(ctx.prisma, product.id);
  if (!providerProduct) {
    throw new NotFoundError('No fulfillment provider is currently configured for this product');
  }

  const adapter = getTopupProvider(providerProduct.provider.code);
  return adapter.validatePlayer({
    providerProductCode: providerProduct.providerProductCode,
    playerId: input.playerId,
    // The adapter's serverId means "real identity", not pricing region —
    // see the zoneId comment on the Order model.
    serverId: input.zoneId,
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

  if (!['PENDING', 'PAID'].includes(order.status)) return;
  // Only one callback may claim fulfillment when the payment provider retries.
  const claimed = await ctx.prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: 'PROCESSING', paidAt: order.paidAt ?? new Date() },
    });
    if (!result.count) return false;
    if (order.status === 'PENDING') {
      assertTransition('PENDING', 'PAID');
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'PENDING', toStatus: 'PAID', reason: 'Payment confirmed' } });
    }
    assertTransition('PAID', 'PROCESSING');
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'PAID', toStatus: 'PROCESSING', reason: 'Fulfillment started' } });
    return true;
  });
  if (!claimed) return;
  const status = 'PROCESSING' as const;

  const item = order.items[0];
  if (!item) {
    await transitionOrder(ctx, { id: order.id, status }, 'FAILED', 'Order has no line items');
    return;
  }

  const providerProducts = await listFulfillmentCandidates(ctx.prisma, item.productId);

  if (!providerProducts.length) {
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: { failureReason: 'No active fulfillment provider configured' },
    });
    await transitionOrder(ctx, { id: order.id, status }, 'FAILED', 'No active fulfillment provider configured');
    return;
  }

  await runFulfillmentCandidates(
    ctx,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status,
      playerId: order.playerId,
      zoneId: order.zoneId,
      serverId: order.serverId,
    },
    providerProducts,
  );
}

/** Re-attempts fulfillment for an order stuck in FAILED. Admin-only — see modules/admin. */
export async function retryFulfillment(ctx: OrderContext, orderId: string): Promise<void> {
  const order = await ctx.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order.paidAt || order.status !== 'FAILED') {
    throw new ConflictError('Only paid, failed orders can be retried');
  }

  const item = order.items[0];
  if (!item) {
    throw new ConflictError('Order has no line items to fulfill');
  }

  const attemptedProviderIds = (await ctx.prisma.providerAttempt.findMany({
    where: { orderId, status: 'FAILED' },
    select: { providerId: true },
  })).map((attempt) => attempt.providerId);
  let providerProducts = await listFulfillmentCandidates(ctx.prisma, item.productId, attemptedProviderIds);
  // An explicit admin retry may try the cheapest ladder again after every
  // provider has already rejected the order once.
  if (!providerProducts.length) {
    providerProducts = await listFulfillmentCandidates(ctx.prisma, item.productId);
  }
  if (!providerProducts.length) {
    throw new ConflictError('No active fulfillment provider configured for this product');
  }

  const status = await ctx.prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({ where: { id: orderId, status: 'FAILED', paidAt: { not: null } }, data: { status: 'PROCESSING', failureReason: null } });
    if (!claimed.count) throw new ConflictError('Order is already being processed');
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'FAILED', toStatus: 'PROCESSING', reason: 'Fulfillment retried by admin' } });
    return 'PROCESSING' as const;
  });
  await runFulfillmentCandidates(
    ctx,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status,
      playerId: order.playerId,
      zoneId: order.zoneId,
      serverId: order.serverId,
    },
    providerProducts,
  );
}

async function runFulfillmentCandidates(
  ctx: OrderContext,
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    playerId: string;
    zoneId: string | null;
    serverId: string | null;
  },
  providerProducts: FulfillmentCandidate[],
): Promise<void> {
  let lastReason = 'Every active fulfillment provider rejected the order';

  for (const providerProduct of providerProducts) {
    const outcome = await runFulfillmentAttempt(ctx, order, providerProduct);
    if (outcome.status === 'PENDING') return;
    if (outcome.status === 'SUCCESS') {
      await transitionOrder(ctx, order, 'COMPLETED', `Fulfillment succeeded via ${providerProduct.provider.code}`);
      notifyAdmins(`✅ <b>Order completed</b> #${order.orderNumber}\nProvider: ${providerProduct.provider.code}`);
      await createNotification(ctx, {
        userId: order.userId,
        type: 'ORDER_SUCCESS',
        title: 'Top-up completed',
        body: `Order #${order.orderNumber} was delivered successfully.`,
        deepLink: `/orders/${order.id}`,
      });
      return;
    }
    lastReason = outcome.reason;
    if (!outcome.canFallback) break;
  }

  await ctx.prisma.order.update({
    where: { id: order.id },
    data: { failureReason: lastReason },
  });
  await transitionOrder(ctx, order, 'FAILED', lastReason);
  notifyAdmins(`❌ <b>Order failed</b> #${order.orderNumber}\nReason: ${lastReason}`);
  await createNotification(ctx, {
    userId: order.userId,
    type: 'ORDER_FAILED',
    title: 'Order failed',
    body: `Order #${order.orderNumber} could not be completed. We'll help sort it out.`,
    deepLink: `/orders/${order.id}`,
  });
}

async function runFulfillmentAttempt(
  ctx: OrderContext,
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    playerId: string;
    zoneId: string | null;
    serverId: string | null;
  },
  providerProduct: FulfillmentCandidate,
): Promise<{ status: 'PENDING' | 'SUCCESS' | 'FAILED'; reason: string; canFallback: boolean }> {
  const adapter = getTopupProvider(providerProduct.provider.code);
  const attemptNumber =
    (await ctx.prisma.providerAttempt.count({ where: { orderId: order.id } })) + 1;

  let result;
  try {
    result = await adapter.createTopup({
      providerProductCode: providerProduct.providerProductCode,
      playerId: order.playerId,
      // The adapter's serverId means "real identity", not pricing region —
      // see the zoneId comment on the Order model.
      serverId: order.zoneId ?? undefined,
      // The GameServer.code the buyer picked before checkout (e.g. "ASIA") —
      // the pricing region, not their account identity. Most providers never
      // need this (zoneId alone identifies the account), but some categories
      // require the region as its own field on the order itself (Genshin
      // Impact's "server" select on FazerCards) — see gameServerCode's doc
      // comment on CreateTopupParams.
      gameServerCode: order.serverId ?? undefined,
      referenceId: order.id,
    });
  } catch (error) {
    result = {
      success: false,
      reason: error instanceof Error ? error.message : 'Provider request failed without a confirmed response',
      canFallback: false,
    };
  }

  // A timeout/empty response is not proof that the supplier rejected the
  // order: it may have accepted it and lost the response. Keep that attempt
  // pending for manual reconciliation instead of risking a duplicate top-up
  // through the next-cheapest supplier.
  const attemptStatus = result.status ?? (result.success ? 'SUCCESS' : result.canFallback ? 'FAILED' : 'PENDING');
  await ctx.prisma.providerAttempt.create({
    data: {
      orderId: order.id,
      providerId: providerProduct.providerId,
      providerProductCode: providerProduct.providerProductCode,
      attemptNumber,
      status: attemptStatus,
      providerTransactionId: result.providerTransactionId,
      responsePayload: (result.raw ?? {}) as Prisma.InputJsonValue,
      completedAt: attemptStatus === 'PENDING' ? null : new Date(),
    },
  });

  if (attemptStatus !== 'FAILED' && providerProduct.costMinor != null) {
    await ctx.prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: { costMinorSnapshot: providerProduct.costMinor },
    });
  }

  return {
    status: attemptStatus,
    reason: result.reason ?? `${providerProduct.provider.code} rejected fulfillment`,
    canFallback: result.canFallback === true,
  };
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

  if (!order.paidAt) throw new ConflictError('Only paid orders can be refunded');
  if (order.currency === 'XTR') {
    assertTransition(order.status, 'REFUNDED');
    const payment = await ctx.prisma.payment.findFirst({ where: { orderId, status: 'SUCCEEDED', currency: 'XTR' } });
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: order.userId } });
    if (!payment?.telegramChargeId || !user.telegramId) throw new ConflictError('Telegram charge is missing');
    try {
      await telegramApi('refundStarPayment', { user_id: Number(user.telegramId), telegram_payment_charge_id: payment.telegramChargeId });
    } catch (error) {
      if (!(error instanceof TelegramApiError) || !error.description.includes('CHARGE_ALREADY_REFUNDED')) throw error;
    }
    await transitionOrder(ctx, order, 'REFUNDED', reason ?? 'Telegram Stars refunded by admin');
    return ctx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  if (order.currency !== 'UZS') throw new ConflictError('Wallet refunds require UZS');
  await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    assertTransition(current.status, 'REFUNDED');
    await walletService.creditOrderRefund(tx, { userId: order.userId, orderId, amountMinor: order.amountMinor, adminId, reason });
    await transitionOrder({ prisma: tx }, current, 'REFUNDED', reason ?? 'Refunded by admin');
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
