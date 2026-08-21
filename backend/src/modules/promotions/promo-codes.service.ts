import type { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../../lib/errors.js';
import * as walletService from '../wallet/wallet.service.js';

interface PromoCodeContext {
  prisma: PrismaClient;
}

/** Distinct code so the client can show "already used" instead of a generic error. */
export class PromoCodeAlreadyRedeemedError extends AppError {
  constructor() {
    super(409, 'PROMO_CODE_ALREADY_REDEEMED', 'This promo code has already been used');
    this.name = 'PromoCodeAlreadyRedeemedError';
  }
}

export async function redeemPromoCode(ctx: PromoCodeContext, userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const promoCode = await ctx.prisma.promoCode.findUnique({ where: { code } });

  if (!promoCode || !promoCode.isActive) {
    throw new NotFoundError('Invalid promo code');
  }
  if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
    throw new NotFoundError('Invalid promo code');
  }
  if (promoCode.maxRedemptions !== null && promoCode.redemptionCount >= promoCode.maxRedemptions) {
    throw new NotFoundError('Invalid promo code');
  }

  const alreadyRedeemed = await ctx.prisma.promoCodeRedemption.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promoCode.id, userId } },
  });
  if (alreadyRedeemed) {
    throw new PromoCodeAlreadyRedeemedError();
  }

  // The redemption row's unique(promoCodeId, userId) constraint is the real
  // double-redeem guard (same "DB-enforced, not just checked-then-written"
  // pattern as wallet.service.ts's idempotency key) — the findUnique above
  // is just a fast, friendly rejection before hitting that constraint.
  try {
    await ctx.prisma.promoCodeRedemption.create({
      data: { promoCodeId: promoCode.id, userId },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new PromoCodeAlreadyRedeemedError();
    }
    throw err;
  }

  await ctx.prisma.promoCode.update({
    where: { id: promoCode.id },
    data: { redemptionCount: { increment: 1 } },
  });

  await walletService.creditWallet(ctx, {
    userId,
    type: 'BONUS',
    amountMinor: promoCode.bonusAmountMinor,
    idempotencyKey: `promo-code:${promoCode.id}:${userId}`,
    reference: promoCode.code,
    reason: `Promo code ${promoCode.code}`,
  });

  return walletService.getWalletSummary(ctx, userId);
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
