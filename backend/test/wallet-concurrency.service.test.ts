import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { InsufficientBalanceError, creditWallet, debitWallet } from '../src/modules/wallet/wallet.service.js';

// applyLedgerEntry's whole reason for existing is to survive real concurrent
// callers without double-crediting or overdrawing — the existing
// wallet.service.test.ts only covers input validation against a stubbed
// Prisma. This exercises the actual atomic-UPDATE + idempotency-race
// guarantees against a live database with genuinely concurrent requests,
// which is the only way either guarantee can actually be verified.

const prisma = new PrismaClient();
const ctx = { prisma };

let userId: string;
const STARTING_BALANCE_MINOR = 100_00; // 100.00 in test currency units

async function makeTestUserWithWallet(startingBalanceMinor: number) {
  const user = await prisma.user.create({
    data: {
      publicId: `WCT${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20).toUpperCase(),
      email: `vitest-wallet-concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@uzdonate.dev`,
      passwordHash: 'x',
      locale: 'uz',
      emailVerifiedAt: new Date(),
      wallet: { create: { balanceMinor: startingBalanceMinor } },
    },
  });
  return user.id;
}

async function cleanup(id: string) {
  await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: id } } });
  await prisma.wallet.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
}

describe('applyLedgerEntry (live DB) — concurrency guarantees', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('idempotency under real concurrent duplicate calls', () => {
    beforeEach(async () => {
      userId = await makeTestUserWithWallet(STARTING_BALANCE_MINOR);
    });

    it('applies the same credit exactly once when 10 concurrent calls share one idempotency key', async () => {
      const idempotencyKey = `concurrency-test-credit-${userId}`;
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          creditWallet(ctx, {
            userId,
            type: 'ADJUSTMENT',
            amountMinor: 5_000_00,
            idempotencyKey,
            reason: 'concurrency test',
          }),
        ),
      );

      // Every call must resolve to the exact same row — the 9 losers of the
      // unique-constraint race get handed the winner's row back, not an error.
      const distinctIds = new Set(results.map((r) => r.id));
      expect(distinctIds.size).toBe(1);

      const transactionCount = await prisma.walletTransaction.count({ where: { idempotencyKey } });
      expect(transactionCount).toBe(1);

      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      expect(wallet.balanceMinor).toBe(STARTING_BALANCE_MINOR + 5_000_00);

      await cleanup(userId);
    });
  });

  describe('overdraft protection under real concurrent debits', () => {
    beforeEach(async () => {
      userId = await makeTestUserWithWallet(STARTING_BALANCE_MINOR);
    });

    it('lets only as many concurrent debits succeed as the balance actually covers, never overdrawing', async () => {
      // Balance is 100.00; ten concurrent debits of 15.00 each can only let
      // 6 succeed (90.00) — a 7th would take it negative. Which 6 win the
      // race is unpredictable; that they're exactly 6, and that the final
      // balance is exactly right, is not.
      const debitAmount = 15_00;
      const attempts = 10;
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          debitWallet(ctx, {
            userId,
            type: 'ADJUSTMENT',
            amountMinor: debitAmount,
            idempotencyKey: `concurrency-test-debit-${userId}-${i}`,
            reason: 'concurrency test',
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(6);
      expect(failed).toHaveLength(4);
      for (const failure of failed) {
        if (failure.status === 'rejected') {
          expect(failure.reason).toBeInstanceOf(InsufficientBalanceError);
        }
      }

      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
      expect(wallet.balanceMinor).toBe(STARTING_BALANCE_MINOR - 6 * debitAmount);
      expect(wallet.balanceMinor).toBeGreaterThanOrEqual(0);

      const recordedDebits = await prisma.walletTransaction.count({
        where: { walletId: (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).id, direction: 'DEBIT' },
      });
      expect(recordedDebits).toBe(6);

      await cleanup(userId);
    });
  });
});
