import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { listGames } from '../src/modules/games/games.service.js';

const prisma = new PrismaClient();
const createdGameIds: string[] = [];

describe('public games catalog', () => {
  beforeAll(async () => {
    const suffix = randomUUID();
    const [empty, disabledOnly, available] = await Promise.all([
      prisma.game.create({ data: { slug: `empty-${suffix}`, name: 'Empty test game', availability: 'ACTIVE', sortOrder: 9991 } }),
      prisma.game.create({ data: { slug: `disabled-${suffix}`, name: 'Disabled product game', availability: 'ACTIVE', sortOrder: 9992 } }),
      prisma.game.create({ data: { slug: `available-${suffix}`, name: 'Available test game', availability: 'ACTIVE', sortOrder: 9993 } }),
    ]);
    createdGameIds.push(empty.id, disabledOnly.id, available.id);
    await prisma.product.createMany({
      data: [
        { gameId: disabledOnly.id, name: 'Disabled package', amountMinor: 1000_00, isActive: false },
        { gameId: available.id, name: 'Available package', amountMinor: 1000_00, isActive: true },
      ],
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { gameId: { in: createdGameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await prisma.$disconnect();
  });

  it('marks a game purchasable only when it has an active product', async () => {
    const games = await listGames(prisma);
    const created = games.filter((game) => createdGameIds.includes(game.id));
    expect(created.map((game) => [game.name, game.isPurchasable])).toEqual([
      ['Empty test game', false],
      ['Disabled product game', false],
      ['Available test game', true],
    ]);
  });
});
