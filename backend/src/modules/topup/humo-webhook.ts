import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { safeEqual } from '../../lib/crypto.js';
import { humoTransactionSchema } from './topup.schemas.js';
import * as topupService from './topup.service.js';

/**
 * Receives normalized HUMO/UZCARD credits from a trusted transaction feed.
 * The bundled Telegram listener is one possible source; a payment provider can
 * post the same payload to the generic endpoint. A shared secret authenticates
 * the sender, and the transaction ID prevents replayed credits. The route is
 * disabled when no card-transaction webhook secret is configured.
 */
export async function humoWebhookRoutes(app: FastifyInstance) {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = env.CARD_TRANSACTION_WEBHOOK_SECRET || env.HUMO_WEBHOOK_SECRET;
    if (!secret) {
      return reply.status(404).send();
    }

    const providedSecret = request.headers['x-webhook-secret'];
    if (typeof providedSecret !== 'string' || !safeEqual(providedSecret, secret)) {
      return reply.status(401).send({ error: 'Invalid webhook secret' });
    }

    const parsed = humoTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
    }

    try {
      const event = await app.prisma.webhookEvent.create({
        data: {
          provider: 'CARD_TRANSACTION',
          providerEventId: parsed.data.transactionId,
          eventType: 'card.credit',
          payload: parsed.data,
        },
      });
      const result = await topupService.autoVerifyFromCardTransaction({ prisma: app.prisma }, parsed.data);
      await app.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: result ? 'PROCESSED' : 'IGNORED', processedAt: new Date() },
      });
      return reply.send({ matched: result !== null, duplicate: false });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.send({ matched: false, duplicate: true });
      }
      throw error;
    }
  };
  app.post('/webhooks/card-transaction', handler);
  app.post('/webhooks/humo-transaction', handler);
}
