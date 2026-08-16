import { Prisma, type PrismaClient, type WalletTransactionDirection, type WalletTransactionType } from '@prisma/client';
import { AppError } from '../../lib/errors.js';

interface WalletContext {
  prisma: PrismaClient;
}

/** Distinct code (not the generic CONFLICT) so clients can show a "Top up" CTA specifically. */
export class InsufficientBalanceError extends AppError {
  constructor() {
    super(409, 'INSUFFICIENT_BALANCE', 'Insufficient wallet balance');
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * register()/googleAuth() create the wallet atomically with the account, so
 * this is a defensive fallback for any user row that predates the wallet
 * feature — never the primary path.
 */
export async function getOrCreateWallet(ctx: WalletContext, userId: string) {
  const existing = await ctx.prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return ctx.prisma.wallet.create({ data: { userId } });
}

export async function getWalletSummary(ctx: WalletContext, userId: string) {
  const wallet = await getOrCreateWallet(ctx, userId);
  return { balanceMinor: wallet.balanceMinor, currency: wallet.currency };
}

export async function listWalletTransactions(ctx: WalletContext, userId: string, limit: number) {
  const wallet = await getOrCreateWallet(ctx, userId);
  return ctx.prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

interface LedgerEntryInput {
  userId: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  amountMinor: number;
  /** Guards against ever applying the same source event twice — e.g. "topup:<id>", "order-purchase:<orderId>". */
  idempotencyKey: string;
  reference?: string;
  reason?: string;
  orderId?: string;
  topUpRequestId?: string;
  createdByAdminId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The ONLY function in the codebase allowed to change a wallet's balance.
 * No other module should ever write `wallets.balance_minor` directly.
 *
 * Concurrency safety: the balance change and the negative-balance check
 * happen in a single atomic `UPDATE ... WHERE balance_minor + delta >= 0`
 * statement — Postgres guarantees no other transaction can interleave
 * between the check and the write, so two concurrent debits can never both
 * succeed past a balance neither could individually afford, without needing
 * an explicit row lock.
 *
 * Idempotency: `idempotencyKey` has a DB unique constraint. If the insert
 * loses that race (a retried webhook, a double-tapped admin action, two
 * requests racing), the whole transaction — including the balance UPDATE —
 * rolls back automatically, and we return the entry that actually won
 * instead of applying the change twice.
 */
export async function applyLedgerEntry(ctx: WalletContext, input: LedgerEntryInput) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('amountMinor must be a positive integer');
  }

  const alreadyApplied = await ctx.prisma.walletTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (alreadyApplied) {
    return alreadyApplied;
  }

  await getOrCreateWallet(ctx, input.userId);
  const delta = input.direction === 'CREDIT' ? input.amountMinor : -input.amountMinor;

  try {
    return await ctx.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ balance_minor: number; currency: string; id: string }[]>`
        UPDATE wallets
        SET balance_minor = balance_minor + ${delta}, updated_at = now()
        WHERE user_id = ${input.userId}::uuid
          AND balance_minor + ${delta} >= 0
        RETURNING id, balance_minor, currency
      `;

      const updated = rows[0];
      if (!updated) {
        throw new InsufficientBalanceError();
      }

      return tx.walletTransaction.create({
        data: {
          walletId: updated.id,
          type: input.type,
          direction: input.direction,
          amountMinor: input.amountMinor,
          currency: updated.currency,
          balanceAfterMinor: updated.balance_minor,
          idempotencyKey: input.idempotencyKey,
          reference: input.reference,
          reason: input.reason,
          orderId: input.orderId,
          topUpRequestId: input.topUpRequestId,
          createdByAdminId: input.createdByAdminId,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await ctx.prisma.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (winner) return winner;
    }
    throw err;
  }
}

export function creditWallet(
  ctx: WalletContext,
  input: Omit<LedgerEntryInput, 'direction'>,
) {
  return applyLedgerEntry(ctx, { ...input, direction: 'CREDIT' });
}

export function debitWallet(
  ctx: WalletContext,
  input: Omit<LedgerEntryInput, 'direction'>,
) {
  return applyLedgerEntry(ctx, { ...input, direction: 'DEBIT' });
}
