import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../lib/validate.js';
import { upsertSavedGameSchema } from './saved-games.schemas.js';
import * as savedGamesService from './saved-games.service.js';
import type { UpsertSavedGameInput } from './saved-games.schemas.js';

/** "My Games" — a saved Player ID/Server ID per game, for one-tap repeat purchases. */
export async function savedGamesRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/saved-games', { preHandler: authenticate }, async (request) => {
    const savedGames = await savedGamesService.listSavedGames(ctx, request.currentUser!.id);
    return { savedGames };
  });

  app.put<{ Params: { gameId: string } }>(
    '/saved-games/:gameId',
    { preHandler: [authenticate, validateBody(upsertSavedGameSchema)] },
    async (request) => {
      const body = request.body as UpsertSavedGameInput;
      return savedGamesService.upsertSavedGame(ctx, request.currentUser!.id, request.params.gameId, body);
    },
  );

  app.delete<{ Params: { gameId: string } }>(
    '/saved-games/:gameId',
    { preHandler: authenticate },
    async (request, reply) => {
      await savedGamesService.deleteSavedGame(ctx, request.currentUser!.id, request.params.gameId);
      return reply.status(204).send();
    },
  );
}
