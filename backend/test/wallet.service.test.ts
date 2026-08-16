import { describe, expect, it } from 'vitest';
import { applyLedgerEntry, InsufficientBalanceError } from '../src/modules/wallet/wallet.service.js';

// A prisma stub that throws if anything actually queries it — proves the
// amountMinor guard rejects bad input before touching the database at all.
const explodingPrisma = new Proxy(
  {},
  {
    get() {
      throw new Error('applyLedgerEntry should not touch the database for invalid input');
    },
  },
) as never;

describe('applyLedgerEntry input validation', () => {
  const baseInput = {
    userId: '00000000-0000-0000-0000-000000000000',
    type: 'ADJUSTMENT' as const,
    direction: 'CREDIT' as const,
    idempotencyKey: 'test-key',
  };

  it('rejects a zero amount without touching the database', async () => {
    await expect(
      applyLedgerEntry({ prisma: explodingPrisma }, { ...baseInput, amountMinor: 0 }),
    ).rejects.toThrow('amountMinor must be a positive integer');
  });

  it('rejects a negative amount without touching the database', async () => {
    await expect(
      applyLedgerEntry({ prisma: explodingPrisma }, { ...baseInput, amountMinor: -500 }),
    ).rejects.toThrow('amountMinor must be a positive integer');
  });

  it('rejects a non-integer amount without touching the database', async () => {
    await expect(
      applyLedgerEntry({ prisma: explodingPrisma }, { ...baseInput, amountMinor: 12.5 }),
    ).rejects.toThrow('amountMinor must be a positive integer');
  });
});

describe('InsufficientBalanceError', () => {
  it('carries a distinct error code so clients can show a "Top up" CTA', () => {
    const error = new InsufficientBalanceError();
    expect(error.code).toBe('INSUFFICIENT_BALANCE');
    expect(error.statusCode).toBe(409);
  });
});
