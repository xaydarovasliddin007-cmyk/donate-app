import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { safeEqual } from '../../lib/crypto.js';
import { processPaymentWebhook } from '../../modules/payments/payments.service.js';

/**
 * Click's merchant-side receiver — two calls per successful payment
 * (action=0 Prepare, action=1 Complete), form-encoded, each MD5-signed.
 * Implemented against Click's published Merchant API
 * (https://docs.click.uz) — the numeric error codes are Click's own.
 * Cannot be exercised end-to-end without a real Click merchant account.
 */

const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  BAD_AMOUNT: -2,
};

interface ClickWebhookBody {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  sign_time: string;
  sign_string: string;
  error?: string;
}

export function verifySignature(body: ClickWebhookBody, secretKey: string): boolean {
  const isComplete = body.action === '1';
  const parts = isComplete
    ? [body.click_trans_id, body.service_id, secretKey, body.merchant_trans_id, body.merchant_prepare_id ?? '', body.amount, body.action, body.sign_time]
    : [body.click_trans_id, body.service_id, secretKey, body.merchant_trans_id, body.amount, body.action, body.sign_time];
  const expected = createHash('md5').update(parts.join('')).digest('hex');
  return safeEqual(expected, body.sign_string);
}

export async function clickWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/click', async (request: FastifyRequest, reply) => {
    const body = request.body as ClickWebhookBody;

    if (!env.CLICK_SECRET_KEY || !verifySignature(body, env.CLICK_SECRET_KEY)) {
      return reply.send({ error: CLICK_ERROR.SIGN_FAILED, error_note: 'Invalid signature' });
    }

    const paymentId = body.merchant_trans_id;
    const payment = await app.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return reply.send({ error: CLICK_ERROR.USER_NOT_FOUND, error_note: 'Payment not found' });
    }
    if (payment.amountMinor !== Math.round(Number(body.amount) * 100)) {
      return reply.send({ error: CLICK_ERROR.BAD_AMOUNT, error_note: 'Amount does not match' });
    }

    if (body.action === '0') {
      // Prepare — reserve the transaction, don't settle yet.
      const attempt =
        (await app.prisma.paymentAttempt.findFirst({ where: { providerRef: body.click_trans_id } })) ??
        (await app.prisma.paymentAttempt.create({
          data: { paymentId, providerRef: body.click_trans_id, status: 'INITIATED' },
        }));
      return reply.send({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_prepare_id: attempt.id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'Success',
      });
    }

    if (body.action === '1') {
      // Complete — settle the payment.
      if (payment.status === 'PENDING') {
        const outcome = body.error && Number(body.error) < 0 ? 'FAILED' : 'SUCCEEDED';
        await processPaymentWebhook({ prisma: app.prisma }, {
          provider: 'CLICK',
          providerEventId: `complete-${body.click_trans_id}`,
          eventType: outcome === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
          paymentId,
          outcome,
        });
      }
      return reply.send({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_confirm_id: body.click_trans_id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'Success',
      });
    }

    return reply.send({ error: CLICK_ERROR.TRANSACTION_NOT_FOUND, error_note: 'Unknown action' });
  });
}
