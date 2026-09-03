import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as gamesService from '../src/modules/games/games.service.js';

// Exercises listGameProducts()'s per-viewer discount pricing against a real
// database — the whole point is a Prisma read (User.discountPercent) inline
// with a findMany, which a stubbed client would risk getting subtly wrong.

const prisma = new PrismaClient();

let gameId: string;
let productAmountMinor: number;
const createdUserIds: string[] = [];

async function makeUser(discountPercent: number) {
  const user = await prisma.user.create({
    data: {
      publicId: `VT${Date.now().toString(36)}${createdUserIds.length}`.slice(0, 20).toUpperCase(),
      email: `vitest-games-discount-${Date.now()}-${createdUserIds.length}@uzdonate.dev`,
      passwordHash: 'x',
      locale: 'uz',
      emailVerifiedAt: new Date(),
      discountPercent,
      wallet: { create: {} },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe('listGameProducts (live DB) — per-viewer discount pricing', () => {
  beforeAll(async () => {
    productAmountMinor = 96000_00;
    const game = await prisma.game.create({
      data: {
        slug: `vitest-games-discount-${Date.now()}`,
        name: 'Vitest Discount Test Game',
        availability: 'ACTIVE',
        products: {
          create: {
            name: 'Vitest Test Product',
            amountMinor: productAmountMinor,
            isActive: true,
            isTest: true,
          },
        },
      },
    });
    gameId = game.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { gameId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.wallet.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('shows the full list price to an anonymous (unauthenticated) viewer', async () => {
    const products = await gamesService.listGameProducts(prisma, gameId, undefined, undefined);

    expect(products).toHaveLength(1);
    expect(products[0]!.amountMinor).toBe(productAmountMinor);
    expect(products[0]!.discountPercent).toBe(0);
  });

  it('shows the full list price to a signed-in customer with no discount', async () => {
    const user = await makeUser(0);
    const products = await gamesService.listGameProducts(prisma, gameId, undefined, user.id);

    expect(products[0]!.amountMinor).toBe(productAmountMinor);
  });

  it("shows a reseller's actual discounted price in the catalog, not just at checkout", async () => {
    const user = await makeUser(15);
    const products = await gamesService.listGameProducts(prisma, gameId, undefined, user.id);

    // 15% off 96 000,00 UZS = 81 600,00 UZS — matches applyDiscount exactly,
    // so browsing and checkout never disagree about the price.
    expect(products[0]!.amountMinor).toBe(81600_00);
    expect(products[0]!.discountPercent).toBe(15);
  });
});
