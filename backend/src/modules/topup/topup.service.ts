import type { CardNetwork, PrismaClient, ReceivingMethod, ReceivingMethodType, TopUpChannel } from '@prisma/client';
import { env } from '../../config/env.js';
import { ConflictError, ForbiddenError, NotFoundError, TopUpAmountBusyError, ValidationError } from '../../lib/errors.js';
import { formatMinorAmount } from '../../lib/money.js';
import { notifyAdmins, sendTopUpReceiptPhoto } from '../../lib/telegram.js';
import { createNotification } from '../notifications/notifications.service.js';
import * as walletService from '../wallet/wallet.service.js';
import type { CreateTopUpRequestInput, HumoTransactionInput, SubmitTopUpReceiptInput } from './topup.schemas.js';

interface TopUpContext {
  prisma: PrismaClient;
}

// How long a reservation's amount stays claimed before it's free for
// someone else to be assigned instead. Card/QR payments are near-instant;
// a Paynet terminal top-up needs time to actually walk to a kiosk.
const RESERVATION_TTL_MS: Record<ReceivingMethodType, number> = {
  CARD_TRANSFER: 7 * 60 * 1000,
  QR_CODE: 7 * 60 * 1000,
  PAYNET_TERMINAL: 60 * 60 * 1000,
};

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

function isConfiguredCard(method: ReceivingMethod) {
  return method.type === 'CARD_TRANSFER' && !!method.cardNetwork &&
    !/dev placeholder/i.test(method.cardHolderName) && !!method.cardNumber;
}

export async function listTopUpOptions(ctx: TopUpContext) {
  const methods = await listActiveReceivingMethods(ctx);
  const cards = methods.filter(isConfiguredCard);
  const autoFeedConfigured = Boolean(env.CARD_TRANSACTION_WEBHOOK_SECRET || env.HUMO_WEBHOOK_SECRET);
  return [
    { id: 'HUMO' as const, label: 'HUMO', mode: 'AUTO' as const, available: autoFeedConfigured && cards.some((m) => m.cardNetwork === 'HUMO') },
    { id: 'UZCARD' as const, label: 'UZCARD', mode: 'AUTO' as const, available: autoFeedConfigured && cards.length > 0 },
    { id: 'BANKOMAT' as const, label: 'Bankomat', mode: 'MANUAL' as const, available: cards.length > 0 },
  ];
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
      type: method.type,
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

const AMOUNT_SUGGESTION_STEP_MINOR = 100 * 100;
const AMOUNT_SUGGESTION_ATTEMPTS = 20;

/**
 * Keeps the customer's requested amount unchanged. If it is already reserved,
 * return two genuinely free alternatives in 100 so'm steps for the client to
 * present. The user must explicitly choose a different amount.
 *
 * CARD_TRANSFER only (see reserveTopUpRequest) — it's the one type
 * autoVerifyFromCardTransaction() auto-credits by amount alone, so its
 * amount must stay unique or a bank SMS could match more than one pending
 * request. QR/terminal top-ups are always reviewed manually against the
 * specific request row (no amount-matching feed exists for them), so
 * bumping their amount bought nothing and only left the client staring at
 * a figure they didn't type.
 *
 * Known small race window: two concurrent reservations could both pass this
 * check for the same amount before either commits. That never causes a
 * wrong credit — autoVerifyFromCardTransaction() only auto-finalizes an
 * exact single match, so a collision just falls back to the existing
 * "ambiguous match, needs manual review" path.
 */
async function requireAvailableAmount(ctx: { prisma: Pick<PrismaClient, 'topUpRequest'> }, requestedAmountMinor: number, now: Date): Promise<number> {
  const candidates = Array.from(
    { length: AMOUNT_SUGGESTION_ATTEMPTS + 1 },
    (_, index) => requestedAmountMinor + index * AMOUNT_SUGGESTION_STEP_MINOR,
  ).filter((amount) => amount <= 2_000_000_000);
  const occupiedRows = await ctx.prisma.topUpRequest.findMany({
    where: { status: 'PENDING', amountMinor: { in: candidates }, expiresAt: { gt: now } },
    select: { amountMinor: true },
  });
  const occupied = new Set(occupiedRows.map((row) => row.amountMinor));
  if (!occupied.has(requestedAmountMinor)) return requestedAmountMinor;

  throw new TopUpAmountBusyError({
    requestedAmountMinor,
    suggestedAmountsMinor: candidates.slice(1).filter((amount) => !occupied.has(amount)).slice(0, 2),
  });
}

/**
 * The "here are all the cards, transfer to any of them" flow: unlike
 * createTopUpRequest() (where the user picks a card up front and commits to
 * it), this shows every active receiving method and leaves receivingMethodId
 * null until a matching transaction (or a manual admin review) identifies
 * which one actually got the transfer — see requireAvailableAmount() for how the
 * exact amount stays unambiguous across every concurrently pending request.
 */
/**
 * PAYNET_TERMINAL has no receiving-method data of its own — cash dropped at
 * a Paynet kiosk against a card number lands on that card exactly the same
 * way an app-to-app CARD_TRANSFER does (both ride NBU's interbank rails),
 * so it reuses the CARD_TRANSFER card pool rather than needing its own
 * admin-managed row. Only QR_CODE has genuinely distinct data (the Paynet
 * merchant QR). `type` omitted entirely is the one legacy case that still
 * means "every active method, whatever type" — used both by
 * reserveTopUpRequest() up front and getTopUpRequestForUser() on every poll
 * afterward, so the two never disagree about what a reservation should show.
 */
function receivingMethodsForType(allActiveMethods: ReceivingMethod[], type?: ReceivingMethodType, channel?: TopUpChannel) {
  if (channel === 'HUMO' || channel === 'UZCARD') {
    const networkCards = allActiveMethods.filter((m) => isConfiguredCard(m) && m.cardNetwork === channel);
    if (networkCards.length > 0) return networkCards;
    if (channel === 'UZCARD') return allActiveMethods.filter((m) => isConfiguredCard(m) && m.cardNetwork === 'HUMO');
    return networkCards;
  }
  if (channel === 'BANKOMAT') return allActiveMethods.filter(isConfiguredCard);
  if (!type) return allActiveMethods;
  if (type === 'QR_CODE') return allActiveMethods.filter((m) => m.type === 'QR_CODE');
  return allActiveMethods.filter((m) => m.type === 'CARD_TRANSFER');
}

export async function reserveTopUpRequest(
  ctx: TopUpContext,
  userId: string,
  amountMinor: number,
  type?: ReceivingMethodType,
  channel?: TopUpChannel,
) {
  const now = new Date();

  // Self-healing sweep: nothing depends on a background job for this — a
  // PENDING row past its own expiresAt already doesn't block a new
  // reservation (see requireAvailableAmount), so this just keeps admin-facing
  // status accurate.
  await ctx.prisma.topUpRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  const allActiveMethods = await listActiveReceivingMethods(ctx);
  const activeMethods = receivingMethodsForType(allActiveMethods, type, channel);
  if (activeMethods.length === 0) {
    throw new ConflictError('No receiving methods are configured right now — please try again later');
  }

  // The caller's requested type, not the returned rows' own type — those
  // two now diverge for PAYNET_TERMINAL (see above), and this is what
  // determines both the TTL and which UI the client renders.
  const resolvedType = channel === 'BANKOMAT'
    ? 'PAYNET_TERMINAL'
    : channel === 'HUMO' || channel === 'UZCARD'
      ? 'CARD_TRANSFER'
      : type ?? activeMethods[0]!.type;
  const ttlMs = RESERVATION_TTL_MS[resolvedType];
  const request = await ctx.prisma.$transaction(async (tx) => {
    // Serialize amount allocation across server processes, not just this instance.
    if (resolvedType === 'CARD_TRANSFER') await tx.$executeRaw`SELECT pg_advisory_xact_lock(8632112221)`;
    const resolvedAmountMinor = resolvedType === 'CARD_TRANSFER'
      ? await requireAvailableAmount({ prisma: tx }, amountMinor, now) : amountMinor;
    return tx.topUpRequest.create({
      data: { userId, type: resolvedType, channel, amountMinor: resolvedAmountMinor, expiresAt: new Date(now.getTime() + ttlMs) },
    });
  });

  return { ...request, receivingMethods: activeMethods };
}

interface FinalizeVerificationOptions {
  adminId?: string;
  autoVerified: boolean;
  receivingMethodId?: string;
}

/**
 * The Telegram-bot auto-verify path only (see autoVerifyFromCardTransaction
 * below) — despite the name, this is NOT what the admin's manual
 * verifyTopUpRequest() calls; that one has its own copy further down,
 * deliberately looser (PENDING or EXPIRED — see its doc comment) since a
 * human reviewing a real bank statement should still be able to credit a
 * transfer that arrived a little late. Auto-verify staying PENDING-only is
 * intentional: an expired reservation's amount is free for reuse (see
 * reserveTopUpRequest), so a coincidental later SMS on that same amount
 * must never auto-credit the wrong request. Idempotency key is
 * deterministic on the request ID, so a retried call after a partial
 * failure is safe: applyLedgerEntry just returns the already-applied entry
 * instead of crediting twice.
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
 * requireAvailableAmount() guarantees a CARD_TRANSFER request's amount is unique
 * among concurrently pending ones. Matching is scoped to type: 'CARD_TRANSFER'
 * for exactly that reason — QR_CODE and PAYNET_TERMINAL amounts get no such
 * guarantee (see requireAvailableAmount's doc comment) and PAYNET_TERMINAL sits
 * PENDING for up to an hour, so without this filter an unrelated real card
 * transfer that happens to share a round amount with someone's still-unpaid
 * terminal reservation would silently credit the wrong person's wallet. If
 * that's not exactly one request (should only happen from the narrow race
 * window noted on requireAvailableAmount, or a stale/duplicate notification),
 * this deliberately does nothing rather than guess — it falls back to
 * sitting there for manual admin review instead of risking a wrong credit.
 */
export async function autoVerifyFromCardTransaction(ctx: TopUpContext, input: HumoTransactionInput) {
  const hint = trailingDigits(input.cardHint);
  const now = new Date();

  const activeMethods = await ctx.prisma.receivingMethod.findMany({
    where: { isActive: true, type: 'CARD_TRANSFER', cardNetwork: { not: null } },
  });
  const method = activeMethods.find((m) => isConfiguredCard(m) && trailingDigits(m.cardNumber ?? '') === hint);
  if (!method) {
    return null;
  }

  const matches = await ctx.prisma.topUpRequest.findMany({
    where: {
      status: 'PENDING',
      // Every request predating the `type` column was card-transfer-only
      // by construction (QR/terminal didn't exist yet), so a null here is
      // as safe to match as an explicit CARD_TRANSFER.
      OR: [
        { channel: method.cardNetwork as CardNetwork },
        ...(method.cardNetwork === 'HUMO' ? [{ channel: 'UZCARD' as const }] : []),
        { channel: null, type: 'CARD_TRANSFER' },
        { channel: null, type: null },
      ],
      amountMinor: input.amountMinor,
      expiresAt: { gt: now },
    },
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

/**
 * Lets the caller attach a hint (e.g. a Paynet terminal receipt/check
 * number) to their own still-pending request — this is how the
 * PAYNET_TERMINAL flow's proof-of-payment reaches the admin's manual
 * review screen, since (unlike CARD_TRANSFER) there's no automated
 * transaction feed to match against for that method.
 */
export async function submitTopUpReference(
  ctx: TopUpContext,
  userId: string,
  topUpRequestId: string,
  userReference: string,
) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.userId !== userId) throw new ForbiddenError('This top-up request does not belong to you');
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be updated (this one is ${request.status})`);
  }

  const updated = await ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: { userReference, userConfirmedPaidAt: new Date() },
    include: { receivingMethod: true },
  });

  notifyAdmins(
    `🧾 <b>Terminal receipt submitted</b> — ${formatMinorAmount(request.amountMinor, request.currency)}\n` +
      `Receipt #: ${userReference}\nNeeds review.`,
  );

  return updated;
}

function decodeReceiptImage(input: SubmitTopUpReceiptInput) {
  const image = Buffer.from(input.dataBase64, 'base64');
  if (image.length === 0 || image.length > 5 * 1024 * 1024) {
    throw new ValidationError('Receipt image must be 5 MB or smaller');
  }
  const valid = input.mimeType === 'image/jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : input.mimeType === 'image/png'
      ? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : image.subarray(0, 4).toString('ascii') === 'RIFF' && image.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) throw new ValidationError('Receipt file is not a valid image');
  return image;
}

export async function submitTopUpReceipt(
  ctx: TopUpContext,
  userId: string,
  topUpRequestId: string,
  input: SubmitTopUpReceiptInput,
) {
  const request = await ctx.prisma.topUpRequest.findUnique({
    where: { id: topUpRequestId },
    include: { user: { select: { publicId: true, displayName: true } } },
  });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.userId !== userId) throw new ForbiddenError('This top-up request does not belong to you');
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be updated (this one is ${request.status})`);
  }
  if (request.channel !== 'BANKOMAT' && request.type !== 'PAYNET_TERMINAL') {
    throw new ValidationError('Receipt screenshots are accepted only for Bankomat payments');
  }
  const image = decodeReceiptImage(input);
  const messageId = await sendTopUpReceiptPhoto({
    image,
    mimeType: input.mimeType,
    fileName: input.fileName,
    requestId: request.id,
    userLabel: request.user.displayName || request.user.publicId,
    amount: formatMinorAmount(request.amountMinor, request.currency),
  });
  return ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: { userReference: `Telegram chek #${messageId}`, userConfirmedPaidAt: new Date() },
    include: { receivingMethod: true },
  });
}

/**
 * Fired by the mobile "I've paid" tap for CARD_TRANSFER/QR_CODE — the two
 * types with no automated proof-of-payment feed at all for QR (Paynet's own
 * auto-verify webhook isn't built yet) and only a best-effort SMS listener
 * for CARD_TRANSFER. Never credits anything by itself; just tells the admin
 * queue this reservation is worth checking now instead of waiting out its
 * countdown untouched. Safe to call more than once (e.g. the bot beats the
 * tap to it) — it only ever updates a timestamp and sends one more alert.
 */
export async function confirmTopUpPaid(ctx: TopUpContext, userId: string, topUpRequestId: string) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.userId !== userId) throw new ForbiddenError('This top-up request does not belong to you');
  if (request.status === 'VERIFIED') {
    return request;
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError(`Only PENDING top-up requests can be updated (this one is ${request.status})`);
  }

  const updated = await ctx.prisma.topUpRequest.update({
    where: { id: request.id },
    data: { userConfirmedPaidAt: new Date() },
    include: { receivingMethod: true },
  });

  notifyAdmins(
    `💳 <b>User marked top-up as paid</b> — ${formatMinorAmount(request.amountMinor, request.currency)}\n` +
      `User ID: ${request.userId}\nVerify the payment before crediting the wallet.`,
  );

  return updated;
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
  // to a single method at creation and doesn't use this field. Filtered by
  // the same type the reservation was actually made against — without
  // this, a QR reservation's card image would silently get replaced by an
  // unfiltered card+QR mix the next time the client polls (a real bug this
  // fixes: the client sets state from whatever this returns every 4s).
  if (request.expiresAt) {
    const allActiveMethods = await listActiveReceivingMethods(ctx);
    const receivingMethods = receivingMethodsForType(
      allActiveMethods,
      request.type ?? undefined,
      request.channel ?? undefined,
    );
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
 *
 * Allowed from PENDING or EXPIRED (not VERIFIED/REJECTED, which are
 * already final): a reservation's countdown only controls how long its
 * amount stays exclusively claimed — see reserveTopUpRequest() — it isn't
 * a deadline on whether the transfer itself was legitimate. A customer who
 * transfers a minute after their card assignment expired still genuinely
 * paid, and an admin who can see that transfer on the real bank statement
 * must still be able to credit it manually instead of the money being
 * stuck with no way to apply it.
 */
export async function verifyTopUpRequest(ctx: TopUpContext, adminId: string, topUpRequestId: string) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (request.status !== 'PENDING' && request.status !== 'EXPIRED') {
    throw new ConflictError(`Only PENDING or EXPIRED top-up requests can be verified (this one is ${request.status})`);
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
  input: {
    type?: ReceivingMethodType;
    cardNumber?: string;
    cardHolderName: string;
    bankName?: string;
    cardNetwork?: CardNetwork;
    qrPayload?: string;
    sortOrder?: number;
  },
) {
  return ctx.prisma.receivingMethod.create({ data: input });
}

export async function updateReceivingMethod(
  ctx: TopUpContext,
  id: string,
  changes: {
    isActive?: boolean;
    cardNumber?: string;
    cardHolderName?: string;
    bankName?: string;
    cardNetwork?: CardNetwork;
    qrPayload?: string;
    sortOrder?: number;
  },
) {
  const existing = await ctx.prisma.receivingMethod.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Receiving method not found');
  return ctx.prisma.receivingMethod.update({ where: { id }, data: changes });
}
