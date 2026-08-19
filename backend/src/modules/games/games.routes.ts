import type { FastifyInstance } from 'fastify';
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
    async (request) => {
      const products = await gamesService.listGameProducts(app.prisma, request.params.id, request.query.serverId);
      return { products };
    },
  );

  app.get<{ Params: { id: string } }>('/games/:id/servers', async (request) => {
    const servers = await gamesService.listGameServers(app.prisma, request.params.id);
    return { servers };
  });
}
