import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as adminService from '../src/modules/admin/admin.service.js';
import * as ordersService from '../src/modules/orders/orders.service.js';

// Live-DB: profitInRangeMinor is a plain-JS reduce over a real Prisma
// findMany (groupBy can't do "totalAmountMinor - cost*quantity" per row),
// so a stubbed client risks the join/filter looking right while quietly
// summing the wrong rows.

const prisma = new PrismaClient();
const ctx = { prisma };

let gameId: string;
let productWithCostId: string;
let productNoCostId: string;
let userId: string;
const orderIds: string[] = [];

const KNOWN_COST_MINOR = 60000_00; // 60 000 UZS supplier cost
const KNOWN_SALE_MINOR = 96000_00; // 96 000 UZS customer price -> 36 000 UZS profit
const UNKNOWN_SALE_MINOR = 50000_00;

async function makeCompletedOrder(productId: string, totalAmountMinor: number, costMinorSnapshot: number | null) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `VTPROF-${Date.now()}-${orderIds.length}`,
      userId,
      gameId,
      playerId: 'vitest-player',
      amountMinor: totalAmountMinor,
      status: 'COMPLETED',
      completedAt: new Date(),
      idempotencyKey: `vitest-profit-${Date.now()}-${orderIds.length}`,
      items: {
        create: {
          productId,
          productName: 'Vitest Product',
          quantity: 1,
          unitAmountMinor: totalAmountMinor,
          totalAmountMinor,
          costMinorSnapshot,
        },
      },
    },
    include: { items: true },
  });
  orderIds.push(order.id);
  return order;
}

describe('profit stats + cost-data isolation (live DB)', () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        publicId: `VP${Date.now().toString(36)}`.slice(0, 20).toUpperCase(),
        email: `vitest-profit-${Date.now()}@uzdonate.dev`,
        passwordHash: 'x',
        locale: 'uz',
        emailVerifiedAt: new Date(),
        wallet: { create: {} },
      },
    });
    userId = user.id;

    const game = await prisma.game.create({
      data: {
        slug: `vitest-profit-${Date.now()}`,
        name: 'Vitest Profit Test Game',
        availability: 'ACTIVE',
        products: {
          create: [
            { name: 'Costed Product', amountMinor: KNOWN_SALE_MINOR, costMinor: KNOWN_COST_MINOR, isTest: true },
            { name: 'Uncosted Product', amountMinor: UNKNOWN_SALE_MINOR, isTest: true },
          ],
        },
      },
      include: { products: true },
    });
    gameId = game.id;
    productWithCostId = game.products.find((p) => p.name === 'Costed Product')!.id;
    productNoCostId = game.products.find((p) => p.name === 'Uncosted Product')!.id;

    await makeCompletedOrder(productWithCostId, KNOWN_SALE_MINOR, KNOWN_COST_MINOR);
    await makeCompletedOrder(productNoCostId, UNKNOWN_SALE_MINOR, null);
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { gameId } });
    await prisma.game.delete({ where: { id: gameId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('sums profit only from items with a known cost, excluding — not zeroing — the rest', async () => {
    const from = new Date(Date.now() - 60_000);
    const to = new Date(Date.now() + 60_000);
    const stats = await adminService.getStatsAdmin(ctx, { from, to });

    // Only the costed order contributes: 96 000 - 60 000 = 36 000 UZS.
    expect(stats.profitInRangeMinor).toBeGreaterThanOrEqual(36000_00);
    // The uncosted order's item must be flagged, not silently folded in as
    // if its cost were zero (which would overstate profit).
    expect(stats.profitCostUnknownItemCount).toBeGreaterThanOrEqual(1);

    const gameRow = stats.topGames.find((g) => g.game?.id === gameId);
    expect(gameRow).toBeDefined();
    // Revenue includes both orders (96 000 + 50 000); profit only the costed one.
    expect(gameRow!.revenueMinor).toBe(KNOWN_SALE_MINOR + UNKNOWN_SALE_MINOR);
    expect(gameRow!.profitMinor).toBe(KNOWN_SALE_MINOR - KNOWN_COST_MINOR);
  });

  it('never exposes costMinorSnapshot in the customer-facing order response', async () => {
    const order = await ordersService.getOrderById(ctx, userId, orderIds[0]!);

    for (const item of order.items) {
      expect(item).not.toHaveProperty('costMinorSnapshot');
    }
  });
});
