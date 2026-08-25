import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as topupService from '../src/modules/topup/topup.service.js';

// These exercise reserveTopUpRequest()/autoVerifyFromCardTransaction()
// against a real database rather than a stubbed prisma client: matching
// relies on relational queries (an amount unique among live PENDING rows)
// that a hand-rolled fake would risk getting subtly wrong in a way that
// looks green but doesn't match real Postgres/Prisma behavior. Requires
// DATABASE_URL to be reachable (see backend/README.md); every row this
// suite creates is scoped to its own dedicated test cards and cleaned up
// in afterAll, so it never depends on — or disturbs — whatever receiving
// methods happen to be seeded.

const prisma = new PrismaClient();
const ctx = { prisma };

let testCardAId: string;
let testCardBId: string;
let originallyActiveIds: string[] = [];
const createdUserIds: string[] = [];
let userCounter = 0;

async function makeUser() {
  userCounter += 1;
  const email = `vitest-topup-reservation-${Date.now()}-${userCounter}@uzdonate.dev`;
  const user = await prisma.user.create({
    data: {
      publicId: `VT${Date.now().toString(36)}${userCounter}`.slice(0, 20).toUpperCase(),
      email,
      passwordHash: 'x',
      locale: 'uz',
      emailVerifiedAt: new Date(),
      wallet: { create: {} },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

/** Marks every PENDING request created by this suite as EXPIRED, so each
 * test starts with a clean slate regardless of what the previous test left
 * pending. */
async function clearPendingRequests() {
  await prisma.topUpRequest.updateMany({
    where: { userId: { in: createdUserIds }, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });
}

describe('topup reservation + auto-verification (live DB)', () => {
  beforeAll(async () => {
    const existing = await prisma.receivingMethod.findMany({ where: { isActive: true } });
    originallyActiveIds = existing.map((m) => m.id);
    if (originallyActiveIds.length > 0) {
      await prisma.receivingMethod.updateMany({
        where: { id: { in: originallyActiveIds } },
        data: { isActive: false },
      });
    }
    const [cardA, cardB] = await Promise.all([
      prisma.receivingMethod.create({
        data: {
          cardNumber: '9999 0000 0000 4242',
          cardHolderName: 'Vitest Reservation Test A',
          bankName: 'Test Bank',
          isActive: true,
          sortOrder: -2,
        },
      }),
      prisma.receivingMethod.create({
        data: {
          cardNumber: '9999 1111 1111 5353',
          cardHolderName: 'Vitest Reservation Test B',
          bankName: 'Test Bank',
          isActive: true,
          sortOrder: -1,
        },
      }),
    ]);
    testCardAId = cardA.id;
    testCardBId = cardB.id;
  });

  beforeEach(async () => {
    await clearPendingRequests();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: createdUserIds } } } });
    await prisma.topUpRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    for (const id of [testCardAId, testCardBId]) {
      await prisma.topUpRequest.deleteMany({ where: { receivingMethodId: id } });
      await prisma.receivingMethod.delete({ where: { id } });
    }
    if (originallyActiveIds.length > 0) {
      await prisma.receivingMethod.updateMany({
        where: { id: { in: originallyActiveIds } },
        data: { isActive: true },
      });
    }
    await prisma.$disconnect();
  });

  it('reserves the exact stated amount and lists every active card, with no card assigned yet', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 150000_00);

    expect(reservation.status).toBe('PENDING');
    expect(reservation.amountMinor).toBe(15000000);
    expect(reservation.receivingMethodId).toBeNull();
    expect(reservation.expiresAt).not.toBeNull();
    expect(reservation.receivingMethods.map((m) => m.id).sort()).toEqual([testCardAId, testCardBId].sort());
  });

  it('bumps the amount by a few tiyin when it collides with another live pending request', async () => {
    const user1 = await makeUser();
    const user2 = await makeUser();
    const first = await topupService.reserveTopUpRequest(ctx, user1.id, 10000_00);
    const second = await topupService.reserveTopUpRequest(ctx, user2.id, 10000_00);

    expect(first.amountMinor).toBe(1000000);
    expect(second.amountMinor).toBeGreaterThan(first.amountMinor);
    expect(second.amountMinor).toBeLessThan(first.amountMinor + 100);
  });

  it('auto-verifies on a matching amount + one of our active cards, credits the wallet, and records which card', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      cardHint: '5353',
      amountMinor: reservation.amountMinor,
      rawMessage: 'test transfer',
    });

    expect(result?.id).toBe(reservation.id);
    expect(result?.status).toBe('VERIFIED');
    expect(result?.autoVerified).toBe(true);
    expect(result?.receivingMethodId).toBe(testCardBId);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(reservation.amountMinor);
  });

  it('does nothing for a transaction on a card that is not one of our active receiving methods, even if the amount matches', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      cardHint: '0000', // not testCardA's 4242 nor testCardB's 5353
      amountMinor: reservation.amountMinor,
    });

    expect(result).toBeNull();
    const stillPending = await prisma.topUpRequest.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(stillPending.status).toBe('PENDING');
  });

  it('does nothing for a transaction whose amount matches no pending request', async () => {
    const user = await makeUser();
    await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      cardHint: '4242',
      amountMinor: 999999900,
    });

    expect(result).toBeNull();
  });
});
