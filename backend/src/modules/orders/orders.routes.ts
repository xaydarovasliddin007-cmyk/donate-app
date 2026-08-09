import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { createOrderSchema, listOrdersQuerySchema } from './orders.schemas.js';
import * as ordersService from './orders.service.js';
import type { CreateOrderInput, ListOrdersQuery } from './orders.schemas.js';

export async function ordersRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.post(
    '/orders',
    { preHandler: [authenticate, validateBody(createOrderSchema)] },
    async (request, reply) => {
      const body = request.body as CreateOrderInput;
      const order = await ordersService.createOrder(ctx, request.currentUser!.id, body);
      return reply.status(201).send(order);
    },
  );

  app.get(
    '/orders',
    { preHandler: [authenticate, validateQuery(listOrdersQuerySchema)] },
    async (request) => {
      const query = request.query as ListOrdersQuery;
      const orders = await ordersService.listOrders(ctx, request.currentUser!.id, query.limit);
      return { orders };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: authenticate },
    async (request) => {
      return ordersService.getOrderById(ctx, request.currentUser!.id, request.params.id);
    },
  );
}
