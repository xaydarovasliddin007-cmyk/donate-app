import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { createTopUpRequestSchema, listTopUpRequestsQuerySchema, reserveTopUpRequestSchema } from './topup.schemas.js';
import * as topupService from './topup.service.js';
import type { CreateTopUpRequestInput, ListTopUpRequestsQuery, ReserveTopUpRequestInput } from './topup.schemas.js';

/** Customer-facing UZDONATE card-transfer top-up: submit + track requests. Verification is admin-only (see modules/admin). */
export async function topupRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/topups/receiving-methods', async () => {
    const methods = await topupService.listActiveReceivingMethods(ctx);
    return { receivingMethods: methods };
  });

  app.post(
    '/topups',
    { preHandler: [authenticate, validateBody(createTopUpRequestSchema)] },
    async (request, reply) => {
      const body = request.body as CreateTopUpRequestInput;
      const topUp = await topupService.createTopUpRequest(ctx, request.currentUser!.id, body);
      return reply.status(201).send(topUp);
    },
  );

  app.get(
    '/topups',
    { preHandler: [authenticate, validateQuery(listTopUpRequestsQuerySchema)] },
    async (request) => {
      const query = request.query as ListTopUpRequestsQuery;
      const topUps = await topupService.listMyTopUpRequests(ctx, request.currentUser!.id, query.limit);
      return { topUps };
    },
  );

  // Card-transfer auto-verification flow: assigns the caller exactly one
  // free receiving card for their exact stated amount, instead of letting
  // them pick freely (see topup.service.ts reserveTopUpRequest doc comment).
  app.post(
    '/topups/reserve',
    { preHandler: [authenticate, validateBody(reserveTopUpRequestSchema)] },
    async (request, reply) => {
      const body = request.body as ReserveTopUpRequestInput;
      const topUp = await topupService.reserveTopUpRequest(ctx, request.currentUser!.id, body.amountMinor);
      return reply.status(201).send(topUp);
    },
  );

  app.get<{ Params: { id: string } }>('/topups/:id', { preHandler: authenticate }, async (request) => {
    return topupService.getTopUpRequestForUser(ctx, request.currentUser!.id, request.params.id);
  });
}
