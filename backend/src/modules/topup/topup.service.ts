import type { PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { formatMinorAmount } from '../../lib/money.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as walletService from '../wallet/wallet.service.js';
import type { CreateTopUpRequestInput, HumoTransactionInput } from './topup.schemas.js';

interface TopUpContext {
  prisma: PrismaClient;
}

// How long a reservation's amount stays claimed before it's free for
// someone else to be assigned instead.
const RESERVATION_TTL_MS = 7 * 60 * 1000;

/** Last-4-or-so digits, digits only — how a stored card number and whatever
 * a bank notification message reveals get compared, without either needing
 * to be formatted identically. */
function trailingDigits(value: string): string {
  return value.replace(/\D/g, '').slice(-4);
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

const MAX_AMOUNT_BUMP_ATTEMPTS = 100;

/**
 * Finds an amountMinor no other currently-live PENDING request is using,
 * starting from what the user asked for and adding a 1-99 tiyin bump only
 * if that exact amount is already spoken for. This — not a card exclusively
 * reserved to one request — is what lets reserveTopUpRequest() show every
 * active card as a valid transfer target: whichever card the matching
 * transaction actually lands on, the amount alone identifies the request.
 *
 * Known small race window: two concurrent reservations could both pass this
 * check for the same amount before either commits. That never causes a
 * wrong credit — autoVerifyFromCardTransaction() only auto-finalizes an
 * exact single match, so a collision just falls back to the existing
 * "ambiguous match, needs manual review" path.
 */
async function pickUniqueAmount(ctx: TopUpContext, requestedAmountMinor: number, now: Date): Promise<number> {
  for (let bump = 0; bump < MAX_AMOUNT_BUMP_ATTEMPTS; bump++) {
    const candidate = requestedAmountMinor + bump;
    const clash = await ctx.prisma.topUpRequest.findFirst({
      where: { status: 'PENDING', amountMinor: candidate, expiresAt: { gt: now } },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new ConflictError('Too many top-ups are pending right now — please try again in a few minutes');
}

/**
 * The "here are all the cards, transfer to any of them" flow: unlike
 * createTopUpRequest() (where the user picks a card up front and commits to
 * it), this shows every active receiving method and leaves receivingMethodId
 * null until a matching transaction (or a manual admin review) identifies
 * which one actually got the transfer — see pickUniqueAmount() for how the
 * exact amount stays unambiguous across every concurrently pending request.
 */
export async function reserveTopUpRequest(ctx: TopUpContext, userId: string, amountMinor: number) {
  const now = new Date();

  // Self-healing sweep: nothing depends on a background job for this — a
  // PENDING row past its own expiresAt already doesn't block a new
  // reservation (see pickUniqueAmount), so this just keeps admin-facing
  // status accurate.
  await ctx.prisma.topUpRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  const activeMethods = await listActiveReceivingMethods(ctx);
  if (activeMethods.length === 0) {
    throw new ConflictError('No receiving cards are configured right now — please try again later');
  }

  const uniqueAmountMinor = await pickUniqueAmount(ctx, amountMinor, now);

  const request = await ctx.prisma.topUpRequest.create({
    data: {
      userId,
      amountMinor: uniqueAmountMinor,
      expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS),
    },
  });

  return { ...request, receivingMethods: activeMethods };
}

interface FinalizeVerificationOptions {
  adminId?: string;
  autoVerified: boolean;
  receivingMethodId?: string;
}

/**
 * Shared by the admin's manual verifyTopUpRequest() and the Telegram-bot
 * auto-verify path — credits the wallet and notifies exactly once either
 * way. Idempotency key is deterministic on the request ID, so a retried
 * call after a partial failure is safe: applyLedgerEntry just returns the
 * already-applied entry instead of crediting twice.
 */
async function finalizeVerification(ctx: TopUpContext, requestId: string, options: FinalizeVerificationOptions) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new NotFoundError('Top-up request not found');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be verified (this one is ${request.status})`);
  }

  await walletService.creditWallet(ctx, {
    userId: request.userId,
    type: 'TOPUP',
    amountMinor: request.amountMinor,
    idempotencyKey: `topup:${request.id}`,
    reference: `Top-up ${request.id}`,
    topUpRequestId: request.id,
    createdByAdminId: options.adminId,
  });

  const updated = await ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: {
      status: 'VERIFIED',
      reviewedByAdminId: options.adminId,
      reviewedAt: new Date(),
      autoVerified: options.autoVerified,
      receivingMethodId: options.receivingMethodId,
    },
    include: { receivingMethod: true },
  });

  notifyAdmins(
    `✅ <b>Top-up verified${options.autoVerified ? ' (auto)' : ''}</b> — ` +
      `${formatMinorAmount(request.amountMinor, request.currency)}`,
  );
  await createNotification(ctx, {
    userId: request.userId,
    type: 'TOPUP_SUCCESS',
    title: 'Top-up successful',
    body: `${formatMinorAmount(request.amountMinor, request.currency)} was added to your UZDONATE wallet.`,
    deepLink: '/wallet',
  });

  return updated;
}

/**
 * Called by the Telegram bank-notification webhook (see humo-webhook.ts)
 * for every parsed transaction message. First confirms the transaction
 * actually landed on one of OUR currently-active cards — a coincidental
 * amount match on an unrelated card must never auto-credit anyone — then
 * matches purely on exact amount + still-pending reservation, since
 * reserveTopUpRequest() already guarantees that amount is unique across
 * every concurrently pending request rather than tying it to one card. If
 * that's not exactly one request (should only happen from the narrow race
 * window noted on pickUniqueAmount, or a stale/duplicate notification),
 * this deliberately does nothing rather than guess — it falls back to
 * sitting there for manual admin review instead of risking a wrong credit.
 */
export async function autoVerifyFromCardTransaction(ctx: TopUpContext, input: HumoTransactionInput) {
  const hint = trailingDigits(input.cardHint);
  const now = new Date();

  const activeMethods = await ctx.prisma.receivingMethod.findMany({ where: { isActive: true } });
  const method = activeMethods.find((m) => trailingDigits(m.cardNumber) === hint);
  if (!method) {
    return null;
  }

  const matches = await ctx.prisma.topUpRequest.findMany({
    where: { status: 'PENDING', amountMinor: input.amountMinor, expiresAt: { gt: now } },
  });

  const [match] = matches;
  if (matches.length !== 1 || !match) {
    if (matches.length > 1) {
      notifyAdmins(
        `⚠️ <b>Ambiguous auto top-up match</b> — ${matches.length} pending requests match ` +
          `${formatMinorAmount(input.amountMinor, 'UZS')}. Needs manual review.\n` +
          (input.rawMessage ? `Message: ${input.rawMessage}` : ''),
      );
    }
    return null;
  }

  return finalizeVerification(ctx, match.id, { autoVerified: true, receivingMethodId: method.id });
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

  // Only the reservation flow (expiresAt set) needs the card list re-sent
  // on every poll, so the mobile UI doesn't lose it after the first
  // refresh — the older pick-one-method-up-front flow already committed
  // to a single method at creation and doesn't use this field.
  if (request.expiresAt) {
    const receivingMethods = await listActiveReceivingMethods(ctx);
    return { ...request, receivingMethods };
  }
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
  input: { cardNumber: string; cardHolderName: string; bankName?: string; sortOrder?: number },
) {
  return ctx.prisma.receivingMethod.create({ data: input });
}

export async function updateReceivingMethod(
  ctx: TopUpContext,
  id: string,
  changes: { isActive?: boolean; cardNumber?: string; cardHolderName?: string; bankName?: string; sortOrder?: number },
) {
  const existing = await ctx.prisma.receivingMethod.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Receiving method not found');
  return ctx.prisma.receivingMethod.update({ where: { id }, data: changes });
}
