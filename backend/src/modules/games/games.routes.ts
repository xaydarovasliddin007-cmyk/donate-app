import type { FastifyInstance } from 'fastify';
import { tryAuthenticate } from '../../middleware/authenticate.js';
import * as gamesService from './games.service.js';

export async function gamesRoutes(app: FastifyInstance) {
  app.get('/games', async () => {
    const games = await gamesService.listGames(app.prisma);
    return { games };
  });

  app.get<{ Params: { id: string } }>('/games/:id', async (request) => {
    return gamesService.getGameById(app.prisma, request.params.id);
  });

  app.get<{ Params: { id: string }; Querystring: { serverId?: string } }>(
    '/games/:id/products',
    // Stays browsable without logging in — tryAuthenticate only personalizes
    // pricing (a reseller's standing discount) for whoever's already signed
    // in; it never requires a token the way authenticate() does.
    { preHandler: tryAuthenticate },
    async (request) => {
      const products = await gamesService.listGameProducts(
        app.prisma,
        request.params.id,
        request.query.serverId,
        request.currentUser?.id,
      );
      return { products };
    },
  );

  app.get<{ Params: { id: string } }>('/games/:id/servers', async (request) => {
    const servers = await gamesService.listGameServers(app.prisma, request.params.id);
    return { servers };
  });
}
