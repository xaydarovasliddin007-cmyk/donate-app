import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ConflictError } from '../src/lib/errors.js';
import * as topupService from '../src/modules/topup/topup.service.js';

// These exercise reserveTopUpRequest()/autoVerifyFromCardTransaction()
// against a real database rather than a stubbed prisma client: the card
// assignment query relies on a relational "none of my pending requests are
// still live" filter, which a hand-rolled fake would risk getting subtly
// wrong in a way that looks green but doesn't match real Postgres/Prisma
// behavior. Requires DATABASE_URL to be reachable (see backend/README.md);
// every row this suite creates is scoped to its own dedicated test card and
// cleaned up in afterAll, so it never depends on — or disturbs — whatever
// receiving methods happen to be seeded.

const prisma = new PrismaClient();
const ctx = { prisma };

let testCardId: string;
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

/** Marks every non-terminal request on the test card as EXPIRED, so each
 * test starts with the one dedicated card free regardless of what the
 * previous test left behind. */
async function freeTestCard() {
  await prisma.topUpRequest.updateMany({
    where: { receivingMethodId: testCardId, status: 'PENDING' },
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
    const card = await prisma.receivingMethod.create({
      data: {
        cardNumber: '9999 0000 0000 4242',
        cardHolderName: 'Vitest Reservation Test',
        bankName: 'Test Bank',
        isActive: true,
        sortOrder: -1,
      },
    });
    testCardId = card.id;
  });

  beforeEach(async () => {
    await freeTestCard();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: { in: createdUserIds } } } });
    await prisma.topUpRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    if (testCardId) {
      await prisma.topUpRequest.deleteMany({ where: { receivingMethodId: testCardId } });
      await prisma.receivingMethod.delete({ where: { id: testCardId } });
    }
    if (originallyActiveIds.length > 0) {
      await prisma.receivingMethod.updateMany({
        where: { id: { in: originallyActiveIds } },
        data: { isActive: true },
      });
    }
    await prisma.$disconnect();
  });

  it('assigns the one free card and reserves the exact stated amount', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 150000_00);

    expect(reservation.status).toBe('PENDING');
    expect(reservation.amountMinor).toBe(15000000);
    expect(reservation.receivingMethodId).toBe(testCardId);
    expect(reservation.expiresAt).not.toBeNull();
  });

  it('refuses a second reservation while the only card is still pending on another request', async () => {
    const user1 = await makeUser();
    const user2 = await makeUser();
    await topupService.reserveTopUpRequest(ctx, user1.id, 10000_00);

    await expect(topupService.reserveTopUpRequest(ctx, user2.id, 20000_00)).rejects.toThrow(ConflictError);
  });

  it('auto-verifies on a matching card+amount transaction and credits the wallet exactly once', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      cardHint: '4242',
      amountMinor: 2500000,
      rawMessage: 'test transfer',
    });

    expect(result?.id).toBe(reservation.id);
    expect(result?.status).toBe('VERIFIED');
    expect(result?.autoVerified).toBe(true);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(2500000);
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

  it('frees the card again once its reservation is verified, for the next user', async () => {
    const first = await makeUser();
    const firstReservation = await topupService.reserveTopUpRequest(ctx, first.id, 30000_00);
    await topupService.autoVerifyFromCardTransaction(ctx, {
      cardHint: '4242',
      amountMinor: firstReservation.amountMinor,
    });

    const second = await makeUser();
    const secondReservation = await topupService.reserveTopUpRequest(ctx, second.id, 40000_00);
    expect(secondReservation.receivingMethodId).toBe(testCardId);
  });
});
