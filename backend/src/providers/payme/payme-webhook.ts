import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { safeEqual } from '../../lib/crypto.js';
import { processPaymentWebhook } from '../../modules/payments/payments.service.js';

/**
 * Payme's merchant-side JSON-RPC receiver. Payme's own servers call this
 * endpoint (never the mobile app) to walk a transaction through
 * Check -> Create -> Perform (or Cancel). Implemented against Payme's
 * published Merchant API (https://developer.paycom.uz) — the numeric error
 * codes below are Payme's own, not ours, since Payme's servers parse them
 * programmatically. Cannot be exercised end-to-end without a real Payme
 * merchant account; validate against their sandbox once one exists.
 */

const PAYME_ERROR = {
  INVALID_AUTH: -32504,
  ACCOUNT_NOT_FOUND: -31050,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL_COMPLETED: -31007,
  UNABLE_TO_PERFORM: -31008,
  ALREADY_DONE: -31060,
} as const;

interface RpcRequest {
  method: string;
  params?: Record<string, unknown>;
  id: number | string | null;
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message: { ru: message, en: message, uz: message } } };
}

function isAuthorized(request: FastifyRequest): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith('Basic ') || !env.PAYME_SECRET_KEY) return false;
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const [login, password] = decoded.split(':');
  return login === 'Paycom' && !!password && safeEqual(password, env.PAYME_SECRET_KEY);
}

async function findPaymentAndAttempt(app: FastifyInstance, transactionId: string) {
  const attempt = await app.prisma.paymentAttempt.findFirst({
    where: { providerRef: transactionId },
    include: { payment: true },
  });
  return attempt;
}

export async function paymeWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/payme', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as RpcRequest;

    if (!isAuthorized(request)) {
      return reply.send(rpcError(body.id, PAYME_ERROR.INVALID_AUTH, 'Invalid authorization'));
    }

    const params = (body.params ?? {}) as {
      id?: string;
      time?: number;
      amount?: number;
      account?: { payment_id?: string };
      reason?: number;
    };

    switch (body.method) {
      case 'CheckPerformTransaction': {
        const paymentId = params.account?.payment_id;
        const payment = paymentId ? await app.prisma.payment.findUnique({ where: { id: paymentId } }) : null;
        if (!payment) {
          return reply.send(rpcError(body.id, PAYME_ERROR.ACCOUNT_NOT_FOUND, 'Payment not found'));
        }
        if (payment.status !== 'PENDING' || payment.amountMinor !== params.amount) {
          return reply.send(rpcError(body.id, PAYME_ERROR.INVALID_AMOUNT, 'Amount does not match'));
        }
        return reply.send(rpcResult(body.id, { allow: true }));
      }

      case 'CreateTransaction': {
        const transactionId = params.id!;
        const existing = await findPaymentAndAttempt(app, transactionId);
        if (existing) {
          return reply.send(
            rpcResult(body.id, {
              create_time: existing.createdAt.getTime(),
              transaction: existing.paymentId,
              state: existing.status === 'INITIATED' ? 1 : existing.status === 'SUCCEEDED' ? 2 : -1,
            }),
          );
        }

        const paymentId = params.account?.payment_id;
        const payment = paymentId ? await app.prisma.payment.findUnique({ where: { id: paymentId } }) : null;
        if (!payment) {
          return reply.send(rpcError(body.id, PAYME_ERROR.ACCOUNT_NOT_FOUND, 'Payment not found'));
        }
        if (payment.status !== 'PENDING' || payment.amountMinor !== params.amount) {
          return reply.send(rpcError(body.id, PAYME_ERROR.INVALID_AMOUNT, 'Amount does not match'));
        }

        const attempt = await app.prisma.paymentAttempt.create({
          data: { paymentId: payment.id, providerRef: transactionId, status: 'INITIATED' },
        });
        return reply.send(rpcResult(body.id, { create_time: attempt.createdAt.getTime(), transaction: payment.id, state: 1 }));
      }

      case 'PerformTransaction': {
        const attempt = await findPaymentAndAttempt(app, params.id!);
        if (!attempt) {
          return reply.send(rpcError(body.id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found'));
        }
        if (attempt.payment.status === 'SUCCEEDED') {
          return reply.send(rpcResult(body.id, { transaction: attempt.paymentId, perform_time: Date.now(), state: 2 }));
        }
        if (attempt.payment.status !== 'PENDING') {
          return reply.send(rpcError(body.id, PAYME_ERROR.UNABLE_TO_PERFORM, 'Payment is not payable'));
        }

        await processPaymentWebhook({ prisma: app.prisma }, {
          provider: 'PAYME',
          providerEventId: `perform-${params.id}`,
          eventType: 'payment.succeeded',
          paymentId: attempt.paymentId,
          outcome: 'SUCCEEDED',
        });
        return reply.send(rpcResult(body.id, { transaction: attempt.paymentId, perform_time: Date.now(), state: 2 }));
      }

      case 'CancelTransaction': {
        const attempt = await findPaymentAndAttempt(app, params.id!);
        if (!attempt) {
          return reply.send(rpcError(body.id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found'));
        }
        if (attempt.payment.status === 'PENDING') {
          await processPaymentWebhook({ prisma: app.prisma }, {
            provider: 'PAYME',
            providerEventId: `cancel-${params.id}`,
            eventType: 'payment.failed',
            paymentId: attempt.paymentId,
            outcome: 'FAILED',
          });
        }
        const state = attempt.payment.status === 'SUCCEEDED' ? -2 : -1;
        return reply.send(rpcResult(body.id, { transaction: attempt.paymentId, cancel_time: Date.now(), state }));
      }

      case 'CheckTransaction': {
        const attempt = await findPaymentAndAttempt(app, params.id!);
        if (!attempt) {
          return reply.send(rpcError(body.id, PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found'));
        }
        const state = attempt.payment.status === 'SUCCEEDED' ? 2 : attempt.payment.status === 'FAILED' ? -1 : 1;
        return reply.send(
          rpcResult(body.id, {
            create_time: attempt.createdAt.getTime(),
            perform_time: attempt.payment.status === 'SUCCEEDED' ? attempt.payment.updatedAt.getTime() : 0,
            cancel_time: attempt.payment.status === 'FAILED' ? attempt.payment.updatedAt.getTime() : 0,
            transaction: attempt.paymentId,
            state,
            reason: null,
          }),
        );
      }

      case 'GetStatement': {
        // Not needed for the current flow (Payment/PaymentAttempt is our
        // source of truth) — returns an empty statement rather than
        // erroring, which is a valid response per Payme's spec.
        return reply.send(rpcResult(body.id, { transactions: [] }));
      }

      default:
        return reply.send(rpcError(body.id, PAYME_ERROR.UNABLE_TO_PERFORM, `Unknown method: ${body.method}`));
    }
  });
}
