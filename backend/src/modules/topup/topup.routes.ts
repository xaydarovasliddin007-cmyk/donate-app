import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateQuery } from '../../lib/validate.js';
import {
  createTopUpRequestSchema,
  listTopUpRequestsQuerySchema,
  reserveTopUpRequestSchema,
  submitTopUpReceiptSchema,
  submitTopUpReferenceSchema,
} from './topup.schemas.js';
import * as topupService from './topup.service.js';
import type {
  CreateTopUpRequestInput,
  ListTopUpRequestsQuery,
  ReserveTopUpRequestInput,
  SubmitTopUpReceiptInput,
  SubmitTopUpReferenceInput,
} from './topup.schemas.js';

function customerRateLimitKey(request: FastifyRequest) {
  return request.currentUser?.id ? `user:${request.currentUser.id}` : `ip:${request.ip}`;
}

/** Customer-facing UZDONATE card-transfer top-up: submit + track requests. Verification is admin-only (see modules/admin). */
export async function topupRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/topups/receiving-methods', async () => {
    const methods = await topupService.listActiveReceivingMethods(ctx);
    return { receivingMethods: methods };
  });

  app.get('/topups/options', async () => {
    const options = await topupService.listTopUpOptions(ctx);
    return { options };
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
    {
      // Each reservation scans for a free unique amount and writes a row —
      // cap it so spamming this endpoint can't exhaust available amounts or
      // load the DB.
      config: { rateLimit: {
        max: 15,
        timeWindow: 60_000,
        hook: 'preHandler',
        keyGenerator: customerRateLimitKey,
      } },
      preHandler: [authenticate, validateBody(reserveTopUpRequestSchema)],
    },
    async (request, reply) => {
      const body = request.body as ReserveTopUpRequestInput;
      const topUp = await topupService.reserveTopUpRequest(
        ctx,
        request.currentUser!.id,
        body.amountMinor,
        body.type,
        body.channel,
      );
      return reply.status(201).send(topUp);
    },
  );

  app.get<{ Params: { id: string } }>('/topups/:id', { preHandler: authenticate }, async (request) => {
    return topupService.getTopUpRequestForUser(ctx, request.currentUser!.id, request.params.id);
  });

  // Lets the Paynet-terminal flow attach the check/receipt number to its
  // own pending request, for the admin to see next to it during review.
  app.post<{ Params: { id: string } }>(
    '/topups/:id/reference',
    { preHandler: [authenticate, validateBody(submitTopUpReferenceSchema)] },
    async (request) => {
      const body = request.body as SubmitTopUpReferenceInput;
      return topupService.submitTopUpReference(ctx, request.currentUser!.id, request.params.id, body.userReference);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/topups/:id/receipt',
    {
      bodyLimit: 7_500_000,
      config: { rateLimit: {
        max: 10,
        timeWindow: 10 * 60_000,
        hook: 'preHandler',
        keyGenerator: customerRateLimitKey,
      } },
      preHandler: [authenticate, validateBody(submitTopUpReceiptSchema)],
    },
    async (request) => {
      const body = request.body as SubmitTopUpReceiptInput;
      return topupService.submitTopUpReceipt(ctx, request.currentUser!.id, request.params.id, body);
    },
  );

  // Legacy mobile clients still call this after a card transfer. It records
  // the timestamp only; card verification remains fully automatic.
  app.post<{ Params: { id: string } }>(
    '/topups/:id/confirm-paid',
    { preHandler: authenticate },
    async (request) => {
      return topupService.confirmTopUpPaid(ctx, request.currentUser!.id, request.params.id);
    },
  );
}
