import type { PrismaClient } from '@prisma/client';
import { isProduction } from '../../config/env.js';
import { NotFoundError } from '../../lib/errors.js';
import { applyDiscount } from '../../lib/money.js';

function toPublicGame(game: {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logoEmoji: string | null;
  logoUrl: string | null;
  availability: string;
}) {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    category: game.category,
    logoEmoji: game.logoEmoji,
    logoUrl: game.logoUrl,
    availability: game.availability,
    isPurchasable: game.availability === 'ACTIVE',
  };
}

function toPublicGameServer(server: { id: string; name: string; code: string }) {
  return { id: server.id, name: server.name, code: server.code };
}

function toPublicProduct(
  product: {
    id: string;
    name: string;
    description: string | null;
    amountMinor: number;
    currency: string;
    isTest: boolean;
  },
  discountPercent = 0,
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    // The price this specific viewer would actually be charged — see
    // orders.service.ts's identical use of applyDiscount at order creation.
    // Kept in sync with checkout on purpose: a reseller browsing the
    // catalog should see the exact number they'll pay, not the list price
    // followed by a surprise discount only visible after buying.
    amountMinor: applyDiscount(product.amountMinor, discountPercent),
    currency: product.currency,
    isTest: product.isTest,
    discountPercent,
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

/** Empty for games with no server catalog — the mobile app skips the server-picker step entirely in that case. */
export async function listGameServers(prisma: PrismaClient, gameId: string) {
  const game = await prisma.game.findFirst({ where: { id: gameId, availability: { not: 'DISABLED' } } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }
  const servers = await prisma.gameServer.findMany({
    where: { gameId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return servers.map(toPublicGameServer);
}

/**
 * `serverCode` is required (and validated) for games with a server catalog,
 * ignored otherwise — mirrors the same resolution orders.service.ts does at
 * purchase time, so "what's shown" and "what you can actually buy" never
 * disagree.
 */
export async function listGameProducts(
  prisma: PrismaClient,
  gameId: string,
  serverCode?: string,
  viewerUserId?: string,
) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, availability: { not: 'DISABLED' } },
  });
  if (!game) {
    throw new NotFoundError('Game not found');
  }

  const serverCount = await prisma.gameServer.count({ where: { gameId } });
  let resolvedServerId: string | null = null;
  if (serverCount > 0) {
    if (!serverCode) {
      // No server chosen yet — nothing is purchasable until one is, so an
      // empty list (not an error) lets the UI show "pick a server" instead.
      return [];
    }
    const server = await prisma.gameServer.findUnique({ where: { gameId_code: { gameId, code: serverCode } } });
    if (!server || !server.isActive) {
      return [];
    }
    resolvedServerId = server.id;
  }

  // Anonymous browsing (no token) or a regular customer both resolve to
  // 0% here — only a signed-in reseller/partner account with a standing
  // User.discountPercent sees anything different.
  const discountPercent = viewerUserId
    ? (
        await prisma.user.findUnique({
          where: { id: viewerUserId },
          select: { discountPercent: true },
        })
      )?.discountPercent ?? 0
    : 0;

  const products = await prisma.product.findMany({
    where: {
      gameId,
      isActive: true,
      serverId: resolvedServerId,
    },
    orderBy: [{ sortOrder: 'asc' }, { amountMinor: 'asc' }],
  });
  return products.map((product) => toPublicProduct(product, discountPercent));
}
