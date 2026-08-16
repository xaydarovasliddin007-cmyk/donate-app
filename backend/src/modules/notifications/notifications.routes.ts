import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateQuery } from '../../lib/validate.js';
import { listNotificationsQuerySchema } from './notifications.schemas.js';
import * as notificationsService from './notifications.service.js';
import type { ListNotificationsQuery } from './notifications.schemas.js';

export async function notificationsRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get(
    '/notifications',
    { preHandler: [authenticate, validateQuery(listNotificationsQuerySchema)] },
    async (request) => {
      const query = request.query as ListNotificationsQuery;
      return notificationsService.listNotifications(ctx, request.currentUser!.id, query.limit);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: authenticate },
    async (request, reply) => {
      await notificationsService.markAsRead(ctx, request.currentUser!.id, request.params.id);
      return reply.status(204).send();
    },
  );

  app.post('/notifications/read-all', { preHandler: authenticate }, async (request, reply) => {
    await notificationsService.markAllAsRead(ctx, request.currentUser!.id);
    return reply.status(204).send();
  });
}
