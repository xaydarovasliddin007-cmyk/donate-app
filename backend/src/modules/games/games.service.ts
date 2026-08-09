import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';

function toPublicGame(game: {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logoEmoji: string | null;
  availability: string;
}) {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    category: game.category,
    logoEmoji: game.logoEmoji,
    availability: game.availability,
    isPurchasable: game.availability === 'ACTIVE',
  };
}

function toPublicProduct(product: {
  id: string;
  name: string;
  description: string | null;
  amountMinor: number;
  currency: string;
  isTest: boolean;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    amountMinor: product.amountMinor,
    currency: product.currency,
    isTest: product.isTest,
  };
}

export async function listGames(prisma: PrismaClient) {
  const games = await prisma.game.findMany({
    where: { availability: { not: 'DISABLED' } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return games.map(toPublicGame);
}

export async function getGameById(prisma: PrismaClient, gameId: string) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, availability: { not: 'DISABLED' } },
  });
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  return toPublicGame(game);
}

export async function listGameProducts(prisma: PrismaClient, gameId: string) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, availability: { not: 'DISABLED' } },
  });
  if (!game) {
    throw new NotFoundError('Game not found');
  }

  const products = await prisma.product.findMany({
    where: { gameId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { amountMinor: 'asc' }],
  });
  return products.map(toPublicProduct);
}
