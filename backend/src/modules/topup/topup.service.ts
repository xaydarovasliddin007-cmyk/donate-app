import type { PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { formatMinorAmount } from '../../lib/money.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as walletService from '../wallet/wallet.service.js';
import type { CreateTopUpRequestInput } from './topup.schemas.js';

interface TopUpContext {
  prisma: PrismaClient;
}

export async function listActiveReceivingMethods(ctx: TopUpContext) {
  return ctx.prisma.receivingMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createTopUpRequest(ctx: TopUpContext, userId: string, input: CreateTopUpRequestInput) {
  const method = await ctx.prisma.receivingMethod.findUnique({ where: { id: input.receivingMethodId } });
  if (!method || !method.isActive) {
    throw new NotFoundError('This top-up method is not available');
  }

  const request = await ctx.prisma.topUpRequest.create({
    data: {
      userId,
      receivingMethodId: method.id,
      amountMinor: input.amountMinor,
      userReference: input.userReference,
    },
    include: { receivingMethod: true },
  });

  notifyAdmins(
    `💰 <b>New top-up request</b> — ${formatMinorAmount(request.amountMinor, request.currency)}\n` +
      `Method: ${method.cardHolderName}\nAwaiting verification.`,
  );

  return request;
}

export async function listMyTopUpRequests(ctx: TopUpContext, userId: string, limit: number) {
  return ctx.prisma.topUpRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { receivingMethod: true },
  });
}

export async function getTopUpRequestForUser(ctx: TopUpContext, userId: string, topUpRequestId: string) {
  const request = await ctx.prisma.topUpRequest.findUnique({
    where: { id: topUpRequestId },
    include: { receivingMethod: true },
  });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.userId !== userId) throw new ForbiddenError('This top-up request does not belong to you');
  return request;
}

// --- Admin ------------------------------------------------------------------

export async function listTopUpRequestsAdmin(
  ctx: TopUpContext,
  params: { status?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'; limit: number },
) {
  return ctx.prisma.topUpRequest.findMany({
    where: params.status ? { status: params.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
    include: {
      receivingMethod: true,
      user: { select: { id: true, publicId: true, email: true, phone: true, displayName: true } },
    },
  });
}

/**
 * Credits the wallet ONLY here, ONLY after an admin explicitly verifies —
 * never on user submission. The user's own claim that they paid
 * (`userReference`) is a hint for the admin to match against a real bank
 * statement, never proof by itself.
 */
export async function verifyTopUpRequest(ctx: TopUpContext, adminId: string, topUpRequestId: string) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be verified (this one is ${request.status})`);
  }

  // Idempotency key is deterministic on the request ID, so if the status
  // update below ever fails after this succeeds, retrying verify is safe —
  // applyLedgerEntry will just return the already-applied entry instead of
  // crediting twice.
  await walletService.creditWallet(ctx, {
    userId: request.userId,
    type: 'TOPUP',
    amountMinor: request.amountMinor,
    idempotencyKey: `topup:${request.id}`,
    reference: `Top-up ${request.id}`,
    topUpRequestId: request.id,
    createdByAdminId: adminId,
  });

  const updated = await ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: { status: 'VERIFIED', reviewedByAdminId: adminId, reviewedAt: new Date() },
    include: { receivingMethod: true },
  });

  notifyAdmins(`✅ <b>Top-up verified</b> — ${formatMinorAmount(request.amountMinor, request.currency)}`);
  await createNotification(ctx, {
    userId: request.userId,
    type: 'TOPUP_SUCCESS',
    title: 'Top-up successful',
    body: `${formatMinorAmount(request.amountMinor, request.currency)} was added to your UZDONATE wallet.`,
    deepLink: '/wallet',
  });

  return updated;
}

export async function rejectTopUpRequest(
  ctx: TopUpContext,
  adminId: string,
  topUpRequestId: string,
  rejectionReason: string,
) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be rejected (this one is ${request.status})`);
  }
  if (!rejectionReason.trim()) {
    throw new ValidationError('rejectionReason is required');
  }

  return ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: { status: 'REJECTED', reviewedByAdminId: adminId, reviewedAt: new Date(), rejectionReason },
    include: { receivingMethod: true },
  });
}

// --- Admin: receiving methods (no real card numbers ever hardcoded) -------

export async function listReceivingMethodsAdmin(ctx: TopUpContext) {
  return ctx.prisma.receivingMethod.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createReceivingMethod(
  ctx: TopUpContext,
  input: { cardNumberMasked: string; cardHolderName: string; bankName?: string; sortOrder?: number },
) {
  return ctx.prisma.receivingMethod.create({ data: input });
}

export async function updateReceivingMethod(
  ctx: TopUpContext,
  id: string,
  changes: { isActive?: boolean; cardNumberMasked?: string; cardHolderName?: string; bankName?: string; sortOrder?: number },
) {
  const existing = await ctx.prisma.receivingMethod.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Receiving method not found');
  return ctx.prisma.receivingMethod.update({ where: { id }, data: changes });
}
