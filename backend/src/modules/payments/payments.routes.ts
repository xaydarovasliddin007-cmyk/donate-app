import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../lib/validate.js';
import { isProduction } from '../../config/env.js';
import { createPaymentSchema, simulateWebhookSchema } from './payments.schemas.js';
import * as paymentsService from './payments.service.js';
import type { CreatePaymentInput, SimulateWebhookInput } from './payments.schemas.js';

export async function paymentsRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.post(
    '/payments',
    { preHandler: [authenticate, validateBody(createPaymentSchema)] },
    async (request, reply) => {
      const body = request.body as CreatePaymentInput;
      const payment = await paymentsService.createPayment(ctx, request.currentUser!.id, body);
      return reply.status(201).send(payment);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/payments/:id',
    { preHandler: authenticate },
    async (request) => {
      return paymentsService.getPaymentById(ctx, request.currentUser!.id, request.params.id);
    },
  );

  // Dev/test only: stands in for a real provider's webhook so the full
  // payment -> order fulfillment pipeline can be exercised without live
  // payment credentials. Never registered in production.
  if (!isProduction) {
    app.post<{ Params: { id: string } }>(
      '/payments/:id/dev-simulate',
      { preHandler: [authenticate, validateBody(simulateWebhookSchema)] },
      async (request) => {
        const body = request.body as SimulateWebhookInput;
        return paymentsService.simulateWebhook(ctx, request.currentUser!.id, request.params.id, body.outcome);
      },
    );
  }
}
