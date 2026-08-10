import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';
import type { UpsertSavedGameInput } from './saved-games.schemas.js';

interface SavedGamesContext {
  prisma: PrismaClient;
}

function toPublicSavedGame(profile: {
  id: string;
  playerId: string;
  serverId: string | null;
  updatedAt: Date;
  game: {
    id: string;
    slug: string;
    name: string;
    category: string | null;
    logoEmoji: string | null;
    availability: string;
  };
}) {
  return {
    id: profile.id,
    playerId: profile.playerId,
    serverId: profile.serverId,
    updatedAt: profile.updatedAt,
    game: {
      id: profile.game.id,
      slug: profile.game.slug,
      name: profile.game.name,
      category: profile.game.category,
      logoEmoji: profile.game.logoEmoji,
      availability: profile.game.availability,
      isPurchasable: profile.game.availability === 'ACTIVE',
    },
  };
}

export async function listSavedGames(ctx: SavedGamesContext, userId: string) {
  const profiles = await ctx.prisma.savedPlayerProfile.findMany({
    where: { userId },
    include: { game: true },
    orderBy: { updatedAt: 'desc' },
  });
  return profiles.map(toPublicSavedGame);
}

export async function upsertSavedGame(
  ctx: SavedGamesContext,
  userId: string,
  gameId: string,
  input: UpsertSavedGameInput,
) {
  const game = await ctx.prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }

  const profile = await ctx.prisma.savedPlayerProfile.upsert({
    where: { userId_gameId: { userId, gameId } },
    update: { playerId: input.playerId, serverId: input.serverId },
    create: { userId, gameId, playerId: input.playerId, serverId: input.serverId },
    include: { game: true },
  });

  return toPublicSavedGame(profile);
}

export async function deleteSavedGame(ctx: SavedGamesContext, userId: string, gameId: string) {
  await ctx.prisma.savedPlayerProfile.deleteMany({ where: { userId, gameId } });
}

/**
 * Silently records/updates the player's identity for a game right after a
 * successful order — so a returning customer's next purchase can skip
 * straight to Quick Buy instead of retyping Player ID/Server ID. Failures
 * here must never fail order creation itself (see orders.service.ts).
 */
export async function recordPlayerProfileFromOrder(
  ctx: SavedGamesContext,
  userId: string,
  gameId: string,
  playerId: string,
  serverId: string | null,
): Promise<void> {
  try {
    await ctx.prisma.savedPlayerProfile.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: { playerId, serverId },
      create: { userId, gameId, playerId, serverId },
    });
  } catch {
    // Best-effort convenience feature — never let this block a purchase.
  }
}
