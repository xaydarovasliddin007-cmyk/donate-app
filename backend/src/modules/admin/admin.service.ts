import { randomUUID } from 'node:crypto';
import type { AdminRole, PrismaClient, TopUpRequestStatus, OrderStatus } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import { hashPassword } from '../auth/password.js';
import { refundOrderToWallet, retryFulfillment as retryFulfillmentOrder } from '../orders/orders.service.js';
import * as walletService from '../wallet/wallet.service.js';
import * as topupService from '../topup/topup.service.js';
import type {
  AdminCreateAdminInput,
  AdminCreateGameInput,
  AdminCreateGameServerInput,
  AdminCreateProductInput,
  AdminUpdateAdminInput,
  AdminUpdateGameInput,
  AdminUpdateGameServerInput,
  AdminUpdateProviderInput,
} from './admin.schemas.js';

interface AdminContext {
  prisma: PrismaClient;
}

// --- Orders -----------------------------------------------------------------

export async function listOrdersAdmin(
  ctx: AdminContext,
  params: { status?: OrderStatus; gameId?: string; from?: Date; to?: Date; limit: number },
) {
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.gameId ? { gameId: params.gameId } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    ctx.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      include: {
        game: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, email: true, phone: true, displayName: true } },
        items: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    ctx.prisma.order.count({ where }),
  ]);
  return { orders, total };
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

export async function listUsersAdmin(
  ctx: AdminContext,
  params: { search?: string; limit: number; offset: number },
) {
  const where = params.search
    ? {
        OR: [
          { publicId: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { phone: { contains: params.search } },
          { displayName: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [users, total] = await Promise.all([
    ctx.prisma.user.findMany({
      where,
      select: {
        id: true,
        publicId: true,
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
      take: params.limit,
      skip: params.offset,
    }),
    ctx.prisma.user.count({ where }),
  ]);
  return { users, total };
}

export async function getUserDetailAdmin(ctx: AdminContext, userId: string) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      publicId: true,
      email: true,
      phone: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const [wallet, recentOrders, recentTransactions, activeSessions] = await Promise.all([
    walletService.getWalletSummary(ctx, userId),
    ctx.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { game: { select: { name: true } } },
    }),
    walletService.listWalletTransactions(ctx, userId, 10),
    ctx.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true },
    }),
  ]);

  return { user, wallet, recentOrders, recentTransactions, activeSessions };
}

// --- Games & servers --------------------------------------------------------
//
// Games/products only ever came from prisma/seed.ts until now — this is the
// first admin-editable path for the catalog itself, so a real supplier's
// codes/prices can eventually replace the seed (isTest: true) data without a
// schema change.

export async function listGamesAdmin(ctx: AdminContext, params: { includeDisabled: boolean }) {
  return ctx.prisma.game.findMany({
    where: params.includeDisabled ? undefined : { availability: { not: 'DISABLED' } },
    include: { _count: { select: { products: true, servers: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function createGameAdmin(ctx: AdminContext, adminId: string, input: AdminCreateGameInput) {
  const existing = await ctx.prisma.game.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new ConflictError('A game with this slug already exists');
  }

  const created = await ctx.prisma.game.create({ data: input });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'game.create',
    entityType: 'Game',
    entityId: created.id,
    metadata: { slug: input.slug, name: input.name },
  });

  return created;
}

export async function updateGameAdmin(
  ctx: AdminContext,
  adminId: string,
  gameId: string,
  changes: AdminUpdateGameInput,
) {
  const existing = await ctx.prisma.game.findUnique({ where: { id: gameId } });
  if (!existing) {
    throw new NotFoundError('Game not found');
  }

  const updated = await ctx.prisma.game.update({ where: { id: gameId }, data: changes });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'game.update',
    entityType: 'Game',
    entityId: gameId,
    metadata: { before: existing, after: changes },
  });

  return updated;
}

export async function listGameServersAdmin(ctx: AdminContext, gameId: string) {
  const game = await ctx.prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  return ctx.prisma.gameServer.findMany({ where: { gameId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

export async function createGameServerAdmin(
  ctx: AdminContext,
  adminId: string,
  gameId: string,
  input: AdminCreateGameServerInput,
) {
  const game = await ctx.prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  const existing = await ctx.prisma.gameServer.findUnique({ where: { gameId_code: { gameId, code: input.code } } });
  if (existing) {
    throw new ConflictError('A server with this code already exists for this game');
  }

  const created = await ctx.prisma.gameServer.create({ data: { ...input, gameId } });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'game_server.create',
    entityType: 'GameServer',
    entityId: created.id,
    metadata: { gameId, code: input.code, name: input.name },
  });

  return created;
}

export async function updateGameServerAdmin(
  ctx: AdminContext,
  adminId: string,
  serverId: string,
  changes: AdminUpdateGameServerInput,
) {
  const existing = await ctx.prisma.gameServer.findUnique({ where: { id: serverId } });
  if (!existing) {
    throw new NotFoundError('Game server not found');
  }

  const updated = await ctx.prisma.gameServer.update({ where: { id: serverId }, data: changes });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'game_server.update',
    entityType: 'GameServer',
    entityId: serverId,
    metadata: { before: existing, after: changes },
  });

  return updated;
}

// --- Products -------------------------------------------------------------

export async function listProductsAdmin(ctx: AdminContext, gameId?: string) {
  return ctx.prisma.product.findMany({
    where: gameId ? { gameId } : undefined,
    include: { game: { select: { id: true, name: true, slug: true } }, server: { select: { id: true, name: true } } },
    orderBy: [{ gameId: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function createProductAdmin(ctx: AdminContext, adminId: string, input: AdminCreateProductInput) {
  const game = await ctx.prisma.game.findUnique({ where: { id: input.gameId } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  if (input.serverId) {
    const server = await ctx.prisma.gameServer.findUnique({ where: { id: input.serverId } });
    if (!server || server.gameId !== input.gameId) {
      throw new ValidationError('serverId must reference a server belonging to gameId');
    }
  }

  const created = await ctx.prisma.product.create({ data: input });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'product.create',
    entityType: 'Product',
    entityId: created.id,
    metadata: { gameId: input.gameId, serverId: input.serverId, name: input.name, amountMinor: input.amountMinor },
  });

  return created;
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

/**
 * Per-provider success/failure counts for monitoring — TOPUP providers are
 * measured via ProviderAttempt (fulfillment), PAYMENT providers via Payment
 * status (payments don't have a separate per-attempt provider link; the
 * payment's own terminal status is the meaningful signal there).
 */
export async function getProviderStatsAdmin(ctx: AdminContext) {
  const [providers, topupAttempts, paymentsByProvider] = await Promise.all([
    listProvidersAdmin(ctx),
    ctx.prisma.providerAttempt.groupBy({ by: ['providerId', 'status'], _count: { _all: true } }),
    ctx.prisma.payment.groupBy({
      by: ['providerId', 'status'],
      where: { providerId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, { succeeded: number; failed: number; total: number }>();
  const bump = (providerId: string | null, count: number, isSuccess: boolean, isFailure: boolean) => {
    if (!providerId) return;
    const entry = counts.get(providerId) ?? { succeeded: 0, failed: 0, total: 0 };
    entry.total += count;
    if (isSuccess) entry.succeeded += count;
    if (isFailure) entry.failed += count;
    counts.set(providerId, entry);
  };

  for (const row of topupAttempts) {
    bump(row.providerId, row._count._all, row.status === 'SUCCESS', row.status === 'FAILED');
  }
  for (const row of paymentsByProvider) {
    bump(row.providerId, row._count._all, row.status === 'SUCCEEDED', row.status === 'FAILED');
  }

  return providers.map((provider) => {
    const stat = counts.get(provider.id) ?? { succeeded: 0, failed: 0, total: 0 };
    return {
      ...provider,
      totalAttempts: stat.total,
      succeededAttempts: stat.succeeded,
      failedAttempts: stat.failed,
      successRate: stat.total > 0 ? stat.succeeded / stat.total : null,
    };
  });
}

export async function updateProviderAdmin(
  ctx: AdminContext,
  adminId: string,
  providerId: string,
  changes: AdminUpdateProviderInput,
) {
  const existing = await ctx.prisma.provider.findUnique({ where: { id: providerId } });
  if (!existing) {
    throw new NotFoundError('Provider not found');
  }

  const updated = await ctx.prisma.provider.update({ where: { id: providerId }, data: changes });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'provider.update',
    entityType: 'Provider',
    entityId: providerId,
    metadata: { before: { isActive: existing.isActive }, after: changes },
  });

  return updated;
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

export type StatsRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

/** Resolves a dashboard time-range preset (or explicit custom bounds) to concrete UTC instants. */
export function resolveStatsRange(input: { range: StatsRangePreset; from?: Date; to?: Date }): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  if (input.range === 'custom') {
    return { from: input.from ?? new Date(0), to: input.to ?? now };
  }
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const daysBack = { today: 0, '7d': 7, '30d': 30, '90d': 90 }[input.range];
  const from = new Date(startOfToday.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { from, to: now };
}

/**
 * `range` bounds every time-scoped metric (new users, orders, revenue).
 * Status breakdowns (usersByStatus, ordersByStatus, topUpsByStatus) and the
 * wallet liability snapshot are always point-in-time / all-time — a status
 * distribution doesn't mean much re-scoped to "last 7 days" the way a count
 * does, and the dashboard shows both side by side.
 */
export async function getStatsAdmin(ctx: AdminContext, range: { from: Date; to: Date }) {
  const [
    ordersByStatus,
    totalUsers,
    usersByStatus,
    revenueInRange,
    ordersInRange,
    walletLiability,
    topUpsByStatus,
    newUsersInRange,
  ] = await Promise.all([
    ctx.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    ctx.prisma.user.count(),
    ctx.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
    ctx.prisma.order.groupBy({
      by: ['currency'],
      where: { status: 'COMPLETED', completedAt: { gte: range.from, lte: range.to } },
      _sum: { amountMinor: true },
    }),
    ctx.prisma.order.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    // Total customer-owned balance across all wallets — what UZDONATE
    // currently "owes" its users in future purchases. Always a current
    // snapshot, never scoped to the selected range.
    ctx.prisma.wallet.groupBy({ by: ['currency'], _sum: { balanceMinor: true } }),
    ctx.prisma.topUpRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ctx.prisma.user.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
  ]);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    ordersByStatus: Object.fromEntries(ordersByStatus.map((row) => [row.status, row._count._all])),
    totalUsers,
    usersByStatus: Object.fromEntries(usersByStatus.map((row) => [row.status, row._count._all])),
    newUsersInRange,
    revenueInRangeByCurrency: Object.fromEntries(
      revenueInRange.map((row) => [row.currency, row._sum.amountMinor ?? 0]),
    ),
    ordersInRange,
    walletLiabilityByCurrency: Object.fromEntries(
      walletLiability.map((row) => [row.currency, row._sum.balanceMinor ?? 0]),
    ),
    topUpsByStatus: Object.fromEntries(topUpsByStatus.map((row) => [row.status, row._count._all])),
  };
}

// --- Wallet ---------------------------------------------------------------

export async function getUserWalletAdmin(ctx: AdminContext, userId: string) {
  const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return walletService.getWalletSummary(ctx, userId);
}

export async function listUserWalletTransactionsAdmin(ctx: AdminContext, userId: string, limit: number) {
  return walletService.listWalletTransactions(ctx, userId, limit);
}

/** Every refund ever issued, across all users — a ledger entry (type=REFUND) is the refund record itself, so this is a read, not a separate model. */
export async function listRefundsAdmin(ctx: AdminContext, params: { limit: number }) {
  return ctx.prisma.walletTransaction.findMany({
    where: { type: 'REFUND' },
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    include: {
      wallet: { select: { user: { select: { id: true, publicId: true, email: true, phone: true, displayName: true } } } },
      order: { select: { id: true, orderNumber: true } },
      createdByAdmin: { select: { id: true, fullName: true, email: true } },
    },
  });
}

/**
 * The only way an admin can move wallet money — always ledger-backed
 * (`walletService.applyLedgerEntry`, type=ADJUSTMENT), always requires a
 * reason, always audit-logged. There is no endpoint anywhere that lets an
 * admin `UPDATE wallets SET balance_minor = ...` directly.
 */
export async function adjustWalletAdmin(
  ctx: AdminContext,
  adminId: string,
  userId: string,
  input: { direction: 'CREDIT' | 'DEBIT'; amountMinor: number; reason: string },
) {
  const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const entry = await walletService.applyLedgerEntry(ctx, {
    userId,
    type: 'ADJUSTMENT',
    direction: input.direction,
    amountMinor: input.amountMinor,
    // Each admin adjustment is its own distinct event — never meant to be
    // idempotent/retried the way a webhook is, so the key is freshly random.
    idempotencyKey: `admin-adjustment:${randomUUID()}`,
    reason: input.reason,
    createdByAdminId: adminId,
  });

  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'wallet.adjustment',
    entityType: 'Wallet',
    entityId: userId,
    metadata: { direction: input.direction, amountMinor: input.amountMinor, reason: input.reason },
  });

  return entry;
}

// --- Top-ups ----------------------------------------------------------------

export async function listTopUpsAdmin(
  ctx: AdminContext,
  params: { status?: TopUpRequestStatus; limit: number },
) {
  return topupService.listTopUpRequestsAdmin(ctx, params);
}

export async function verifyTopUpAdmin(ctx: AdminContext, adminId: string, topUpRequestId: string) {
  const result = await topupService.verifyTopUpRequest(ctx, adminId, topUpRequestId);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'topup.verify',
    entityType: 'TopUpRequest',
    entityId: topUpRequestId,
  });
  return result;
}

export async function rejectTopUpAdmin(
  ctx: AdminContext,
  adminId: string,
  topUpRequestId: string,
  rejectionReason: string,
) {
  const result = await topupService.rejectTopUpRequest(ctx, adminId, topUpRequestId, rejectionReason);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'topup.reject',
    entityType: 'TopUpRequest',
    entityId: topUpRequestId,
    metadata: { rejectionReason },
  });
  return result;
}

// --- Receiving methods (never a real hardcoded card — admin-configured) ---

export async function listReceivingMethodsAdmin(ctx: AdminContext) {
  return topupService.listReceivingMethodsAdmin(ctx);
}

export async function createReceivingMethodAdmin(
  ctx: AdminContext,
  adminId: string,
  input: { cardNumberMasked: string; cardHolderName: string; bankName?: string; sortOrder?: number },
) {
  const created = await topupService.createReceivingMethod(ctx, input);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'receiving_method.create',
    entityType: 'ReceivingMethod',
    entityId: created.id,
  });
  return created;
}

export async function updateReceivingMethodAdmin(
  ctx: AdminContext,
  adminId: string,
  id: string,
  changes: {
    isActive?: boolean;
    cardNumberMasked?: string;
    cardHolderName?: string;
    bankName?: string;
    sortOrder?: number;
  },
) {
  const updated = await topupService.updateReceivingMethod(ctx, id, changes);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'receiving_method.update',
    entityType: 'ReceivingMethod',
    entityId: id,
    metadata: changes,
  });
  return updated;
}

// --- Refunds ------------------------------------------------------------------

export async function refundOrderAdmin(ctx: AdminContext, adminId: string, orderId: string, reason?: string) {
  const order = await refundOrderToWallet(ctx, adminId, orderId, reason);
  await writeAuditLog(ctx.prisma, {
    actorId: adminId,
    action: 'order.refund',
    entityType: 'Order',
    entityId: orderId,
    metadata: { reason },
  });
  return order;
}

// --- Admin management (RBAC) — SUPER_ADMIN only, see admin-business.routes.ts ------------

function toPublicAdmin(admin: { id: string; email: string; fullName: string; role: AdminRole; isActive: boolean; createdAt: Date }) {
  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt,
  };
}

export async function listAdminsAdmin(ctx: AdminContext) {
  const admins = await ctx.prisma.adminUser.findMany({ orderBy: { createdAt: 'desc' } });
  return admins.map(toPublicAdmin);
}

export async function createAdminAdmin(ctx: AdminContext, actorId: string, input: AdminCreateAdminInput) {
  const existing = await ctx.prisma.adminUser.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An admin with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const created = await ctx.prisma.adminUser.create({
    data: { email: input.email, passwordHash, fullName: input.fullName, role: input.role },
  });

  await writeAuditLog(ctx.prisma, {
    actorId,
    action: 'admin.create',
    entityType: 'AdminUser',
    entityId: created.id,
    metadata: { email: input.email, role: input.role },
  });

  return toPublicAdmin(created);
}

export async function updateAdminAdmin(
  ctx: AdminContext,
  actorId: string,
  targetAdminId: string,
  changes: AdminUpdateAdminInput,
) {
  if (targetAdminId === actorId && changes.isActive === false) {
    throw new ForbiddenError('You cannot deactivate your own admin account');
  }

  const existing = await ctx.prisma.adminUser.findUnique({ where: { id: targetAdminId } });
  if (!existing) {
    throw new NotFoundError('Admin not found');
  }

  const updated = await ctx.prisma.adminUser.update({ where: { id: targetAdminId }, data: changes });

  await writeAuditLog(ctx.prisma, {
    actorId,
    action: 'admin.update',
    entityType: 'AdminUser',
    entityId: targetAdminId,
    metadata: { before: { isActive: existing.isActive, role: existing.role }, after: changes },
  });

  return toPublicAdmin(updated);
}

// --- Audit logs (read-only) --------------------------------------------------

export async function listAuditLogsAdmin(ctx: AdminContext, params: { entityType?: string; limit: number }) {
  return ctx.prisma.auditLog.findMany({
    where: params.entityType ? { entityType: params.entityType } : undefined,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    include: { actor: { select: { id: true, email: true, fullName: true } } },
  });
}
