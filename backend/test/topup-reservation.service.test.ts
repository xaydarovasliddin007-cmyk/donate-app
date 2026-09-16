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
          cardNetwork: 'HUMO',
          isActive: true,
          sortOrder: -2,
        },
      }),
      prisma.receivingMethod.create({
        data: {
          cardNumber: '9999 1111 1111 5353',
          cardHolderName: 'Vitest Reservation Test B',
          bankName: 'Test Bank',
          cardNetwork: 'UZCARD',
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

  it('bumps the amount by a whole so\'m — never a fraction — when it collides with another live pending request', async () => {
    const user1 = await makeUser();
    const user2 = await makeUser();
    const first = await topupService.reserveTopUpRequest(ctx, user1.id, 10000_00);
    const second = await topupService.reserveTopUpRequest(ctx, user2.id, 10000_00);

    expect(first.amountMinor).toBe(1000000);
    // A bump anywhere but on a whole-so'm boundary would produce an amount
    // (e.g. 10 000,03 UZS) nobody can actually transfer.
    expect(second.amountMinor % 100).toBe(0);
    expect(second.amountMinor).toBeGreaterThan(first.amountMinor);
    expect(second.amountMinor).toBeLessThan(first.amountMinor + 100 * 100);
  });

  it('auto-verifies on a matching amount + one of our active cards, credits the wallet, and records which card', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      transactionId: 'test:auto-success',
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

  it('keeps HUMO and UZCARD reservations on their selected card network', async () => {
    const humoUser = await makeUser();
    const uzcardUser = await makeUser();
    const humo = await topupService.reserveTopUpRequest(ctx, humoUser.id, 25100_00, 'CARD_TRANSFER', 'HUMO');
    const uzcard = await topupService.reserveTopUpRequest(ctx, uzcardUser.id, 25200_00, 'CARD_TRANSFER', 'UZCARD');

    expect(humo.channel).toBe('HUMO');
    expect(humo.receivingMethods.map((method) => method.id)).toEqual([testCardAId]);
    expect(uzcard.channel).toBe('UZCARD');
    expect(uzcard.receivingMethods.map((method) => method.id)).toEqual([testCardBId]);
  });

  it('uses HUMO cards and HUMO auto-verification as the UZCARD fallback', async () => {
    await prisma.receivingMethod.update({ where: { id: testCardBId }, data: { isActive: false } });

    try {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25400_00, 'CARD_TRANSFER', 'UZCARD');

      expect(reservation.channel).toBe('UZCARD');
      expect(reservation.receivingMethods.map((method) => method.id)).toEqual([testCardAId]);

      const result = await topupService.autoVerifyFromCardTransaction(ctx, {
        transactionId: 'test:uzcard-humo-fallback',
        cardHint: '4242',
        amountMinor: reservation.amountMinor,
      });

      expect(result?.id).toBe(reservation.id);
      expect(result?.status).toBe('VERIFIED');
      expect(result?.autoVerified).toBe(true);
    } finally {
      await prisma.receivingMethod.update({ where: { id: testCardBId }, data: { isActive: true } });
    }
  });

  it('never auto-verifies a BANKOMAT request even when card and amount match', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25300_00, 'PAYNET_TERMINAL', 'BANKOMAT');
    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      transactionId: 'test:bankomat-no-auto',
      cardHint: '4242',
      amountMinor: reservation.amountMinor,
    });

    expect(result).toBeNull();
    expect((await prisma.topUpRequest.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('PENDING');
  });

  it('does nothing for a transaction on a card that is not one of our active receiving methods, even if the amount matches', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 25000_00);

    const result = await topupService.autoVerifyFromCardTransaction(ctx, {
      transactionId: 'test:unknown-card',
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
      transactionId: 'test:unknown-amount',
      cardHint: '4242',
      amountMinor: 999999900,
    });

    expect(result).toBeNull();
  });

  it('does not credit the wallet when a user only marks a transfer as paid', async () => {
    const user = await makeUser();
    const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 27000_00, 'CARD_TRANSFER');

    const updated = await topupService.confirmTopUpPaid(ctx, user.id, reservation.id);

    expect(updated.status).toBe('PENDING');
    expect(updated.userConfirmedPaidAt).not.toBeNull();
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balanceMinor).toBe(0);
  });

  describe('reserving against a specific receiving-method type', () => {
    let qrMethodId: string;

    beforeAll(async () => {
      const qr = await prisma.receivingMethod.create({
        data: {
          type: 'QR_CODE',
          cardHolderName: 'Vitest QR Test',
          qrPayload: 'https://example.com/vitest-qr-payload',
          isActive: true,
          sortOrder: -3,
        },
      });
      qrMethodId = qr.id;
    });

    afterAll(async () => {
      await prisma.topUpRequest.deleteMany({ where: { receivingMethodId: qrMethodId } });
      await prisma.receivingMethod.delete({ where: { id: qrMethodId } });
    });

    it('only offers methods of the requested type, not every active method', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 30000_00, 'QR_CODE');

      expect(reservation.receivingMethods).toHaveLength(1);
      expect(reservation.receivingMethods[0]!.id).toBe(qrMethodId);
    });

    it('keeps returning only the QR method on every subsequent poll, not a mix with cards', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 31000_00, 'QR_CODE');

      // This is exactly what the mobile client calls every 4s while waiting
      // — if it ever mixes in the CARD_TRANSFER rows, the QR image the
      // user is looking at would silently disappear mid-wait.
      const polled = await topupService.getTopUpRequestForUser(ctx, user.id, reservation.id);

      expect(polled.receivingMethods).toHaveLength(1);
      expect(polled.receivingMethods[0]!.id).toBe(qrMethodId);
      expect(polled.receivingMethods[0]!.type).toBe('QR_CODE');
    });

    it('never bumps a QR/terminal amount, even on collision — those are always reviewed manually', async () => {
      const user1 = await makeUser();
      const user2 = await makeUser();
      const first = await topupService.reserveTopUpRequest(ctx, user1.id, 35000_00, 'QR_CODE');
      const second = await topupService.reserveTopUpRequest(ctx, user2.id, 35000_00, 'QR_CODE');

      expect(first.amountMinor).toBe(3500000);
      expect(second.amountMinor).toBe(3500000);
    });

    it('rejects QR_CODE when no QR method is active, instead of silently falling back', async () => {
      await prisma.receivingMethod.update({ where: { id: qrMethodId }, data: { isActive: false } });
      try {
        const user = await makeUser();
        await expect(
          topupService.reserveTopUpRequest(ctx, user.id, 30000_00, 'QR_CODE'),
        ).rejects.toThrow(/no receiving methods/i);
      } finally {
        await prisma.receivingMethod.update({ where: { id: qrMethodId }, data: { isActive: true } });
      }
    });

    it('PAYNET_TERMINAL reuses the CARD_TRANSFER pool — cash at a kiosk lands on the same cards', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 30000_00, 'PAYNET_TERMINAL');

      // The request itself remembers what was actually asked for...
      expect(reservation.type).toBe('PAYNET_TERMINAL');
      // ...even though the cards it hands back are ordinary CARD_TRANSFER rows.
      const ids = reservation.receivingMethods.map((m) => m.id).sort();
      expect(ids).toEqual([testCardAId, testCardBId].sort());
      expect(reservation.receivingMethods.every((m) => m.type === 'CARD_TRANSFER')).toBe(true);

      // Polling must keep excluding the QR method — same bug as above,
      // just from the other direction (a card list gaining a broken QR row).
      const polled = await topupService.getTopUpRequestForUser(ctx, user.id, reservation.id);
      expect(polled.receivingMethods.map((m) => m.id).sort()).toEqual(ids);
      expect(polled.receivingMethods.some((m) => m.id === qrMethodId)).toBe(false);
    });

    it('never lets a card SMS auto-credit a pending PAYNET_TERMINAL reservation, even on an exact amount match', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 36000_00, 'PAYNET_TERMINAL');

      // An unrelated real card transfer happens to land on the same round
      // amount the terminal user picked — this must not credit them, since
      // they haven't actually paid anything at a kiosk yet.
      const result = await topupService.autoVerifyFromCardTransaction(ctx, {
        transactionId: 'test:legacy-terminal-no-auto',
        cardHint: '5353',
        amountMinor: reservation.amountMinor,
      });

      expect(result).toBeNull();
      const stillPending = await prisma.topUpRequest.findUniqueOrThrow({ where: { id: reservation.id } });
      expect(stillPending.status).toBe('PENDING');
    });

    it('defaults to any active type when none is given, same as before this feature existed', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 30000_00);

      const ids = reservation.receivingMethods.map((m) => m.id).sort();
      expect(ids).toEqual([testCardAId, testCardBId, qrMethodId].sort());
    });
  });

  describe('submitTopUpReference', () => {
    it('attaches the reference to the caller\'s own pending request', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 40000_00);

      const updated = await topupService.submitTopUpReference(ctx, user.id, reservation.id, 'CHK-12345');

      expect(updated.userReference).toBe('CHK-12345');
    });

    it('refuses to attach a reference to someone else\'s request', async () => {
      const owner = await makeUser();
      const stranger = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, owner.id, 41000_00);

      await expect(
        topupService.submitTopUpReference(ctx, stranger.id, reservation.id, 'CHK-99999'),
      ).rejects.toThrow(/does not belong to you/i);
    });

    it('refuses once the request is no longer PENDING', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 42000_00);
      await topupService.autoVerifyFromCardTransaction(ctx, {
        transactionId: 'test:reference-finalized',
        cardHint: '4242',
        amountMinor: reservation.amountMinor,
      });

      await expect(
        topupService.submitTopUpReference(ctx, user.id, reservation.id, 'CHK-00000'),
      ).rejects.toThrow(/only pending/i);
    });
  });

  describe('verifyTopUpRequest (admin manual review)', () => {
    // reviewedByAdminId is a real FK to AdminUser — reusing whichever admin
    // the dev seed already created rather than making a throwaway one,
    // since this suite doesn't otherwise touch the admin_users table.
    let adminId: string;

    beforeAll(async () => {
      const admin = await prisma.adminUser.findFirstOrThrow();
      adminId = admin.id;
    });

    it('credits an EXPIRED request — a customer who transferred a little late still genuinely paid', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 43000_00);
      await prisma.topUpRequest.update({ where: { id: reservation.id }, data: { status: 'EXPIRED' } });

      const updated = await topupService.verifyTopUpRequest(ctx, adminId, reservation.id);

      expect(updated.status).toBe('VERIFIED');
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
      expect(wallet.balanceMinor).toBe(reservation.amountMinor);
    });

    it('refuses a request that was already REJECTED', async () => {
      const user = await makeUser();
      const reservation = await topupService.reserveTopUpRequest(ctx, user.id, 44000_00);
      await prisma.topUpRequest.update({ where: { id: reservation.id }, data: { status: 'REJECTED' } });

      await expect(topupService.verifyTopUpRequest(ctx, adminId, reservation.id)).rejects.toThrow(
        /pending or expired/i,
      );
    });
  });
});
