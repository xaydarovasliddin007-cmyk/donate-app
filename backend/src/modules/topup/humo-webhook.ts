import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { safeEqual } from '../../lib/crypto.js';
import { humoTransactionSchema } from './topup.schemas.js';
import * as topupService from './topup.service.js';

/**
 * Receiver for the Telegram userbot listener script (scripts/humo-listener.ts),
 * which reads @HUMOcardbot's own DM notifications and forwards each parsed
 * transaction here. Not a bank/payment-gateway webhook — there's no signature
 * from a third party to verify, just a shared secret proving the request came
 * from our own listener script and not a random caller. Disabled entirely
 * (404) when HUMO_WEBHOOK_SECRET isn't configured, matching every other
 * "wired but inert without credentials" provider in this codebase.
 */
export async function humoWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/humo-transaction', async (request: FastifyRequest, reply) => {
    if (!env.HUMO_WEBHOOK_SECRET) {
      return reply.status(404).send();
    }

    const providedSecret = request.headers['x-webhook-secret'];
    if (typeof providedSecret !== 'string' || !safeEqual(providedSecret, env.HUMO_WEBHOOK_SECRET)) {
      return reply.status(401).send({ error: 'Invalid webhook secret' });
    }

    const parsed = humoTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
    }

    const result = await topupService.autoVerifyFromCardTransaction({ prisma: app.prisma }, parsed.data);
    return reply.send({ matched: result !== null });
  });
}
