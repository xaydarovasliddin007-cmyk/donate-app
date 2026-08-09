import type { OrderStatus, PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import { retryFulfillment as retryFulfillmentOrder } from '../orders/orders.service.js';

interface AdminContext {
  prisma: PrismaClient;
}

// --- Orders -----------------------------------------------------------------

export async function listOrdersAdmin(
  ctx: AdminContext,
  params: { status?: OrderStatus; limit: number },
) {
  const orders = await ctx.prisma.order.findMany({
    where: params.status ? { status: params.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    include: {
      game: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, email: true, phone: true, displayName: true } },
      items: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return orders;
}

export async function getOrderAdmin(ctx: AdminContext, orderId: string) {
  const order = await ctx.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      game: true,
      user: { select: { id: true, email: true, phone: true, displayName: true } },
      items: true,
      payments: { include: { attempts: true } },
      providerAttempts: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return order;
}

export async function retryOrderFulfillmentAdmin(ctx: AdminContext, adminId: string, orderId: string) {
  const order = await ctx.prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  if (order.status !== 'FAILED') {
    throw new ConflictError('Only orders in FAILED status can be retried');
  }

  await retryFulfillmentOrder(ctx, orderId);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'order.retry_fulfillment',
    entityType: 'Order',
    entityId: orderId,
  });

  return getOrderAdmin(ctx, orderId);
}

// --- Users --------------------------------------------------------------------

export async function listUsersAdmin(ctx: AdminContext, limit: number) {
  return ctx.prisma.user.findMany({
    select: {
      id: true,
      email: true,
      phone: true,
      displayName: true,
      locale: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// --- Products -------------------------------------------------------------

export async function listProductsAdmin(ctx: AdminContext, gameId?: string) {
  return ctx.prisma.product.findMany({
    where: gameId ? { gameId } : undefined,
    include: { game: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ gameId: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function updateProductAdmin(
  ctx: AdminContext,
  adminId: string,
  productId: string,
  changes: { isActive?: boolean; amountMinor?: number },
) {
  const existing = await ctx.prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }
  if (changes.amountMinor !== undefined && changes.amountMinor <= 0) {
    throw new ValidationError('amountMinor must be a positive integer');
  }

  const updated = await ctx.prisma.product.update({ where: { id: productId }, data: changes });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'product.update',
    entityType: 'Product',
    entityId: productId,
    metadata: { before: { isActive: existing.isActive, amountMinor: existing.amountMinor }, after: changes },
  });

  return updated;
}

// --- Providers --------------------------------------------------------------

export async function listProvidersAdmin(ctx: AdminContext) {
  return ctx.prisma.provider.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
}

// --- Payments -----------------------------------------------------------------

export async function getPaymentAdmin(ctx: AdminContext, paymentId: string) {
  const payment = await ctx.prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true, attempts: { orderBy: { createdAt: 'desc' } }, provider: true },
  });
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }
  return payment;
}

// --- Stats --------------------------------------------------------------------

export async function getStatsAdmin(ctx: AdminContext) {
  const [ordersByStatus, totalUsers, revenueByCurrency, todayOrders] = await Promise.all([
    ctx.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ctx.prisma.user.count(),
    ctx.prisma.order.groupBy({
      by: ['currency'],
      where: { status: 'COMPLETED' },
      _sum: { amountMinor: true },
    }),
    ctx.prisma.order.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return {
    ordersByStatus: Object.fromEntries(ordersByStatus.map((row) => [row.status, row._count._all])),
    totalUsers,
    revenueByCurrency: Object.fromEntries(
      revenueByCurrency.map((row) => [row.currency, row._sum.amountMinor ?? 0]),
    ),
    ordersToday: todayOrders,
  };
}
