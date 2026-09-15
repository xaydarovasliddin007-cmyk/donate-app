import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { gamesRoutes } from './modules/games/games.routes.js';
import { promotionsRoutes } from './modules/promotions/promotions.routes.js';
import { promoCodesRoutes } from './modules/promotions/promo-codes.routes.js';
import { ordersRoutes } from './modules/orders/orders.routes.js';
import { paymentsRoutes } from './modules/payments/payments.routes.js';
import { savedGamesRoutes } from './modules/saved-games/saved-games.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { topupRoutes } from './modules/topup/topup.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { paymeWebhookRoutes } from './providers/payme/payme-webhook.js';
import { clickWebhookRoutes } from './providers/click/click-webhook.js';
import { humoWebhookRoutes } from './modules/topup/humo-webhook.js';
import { telegramRoutes } from './modules/telegram/telegram.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminPublicPath = path.resolve(__dirname, '../public/admin');
const webappPublicPath = path.resolve(__dirname, '../public/webapp');

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    trustProxy: true,
  });

  // Must be set before any routes/hooks are registered: Fastify resolves
  // each encapsulated context's error handler at the time its routes are
  // defined, not lazily per-request — setting this after registering the
  // nested /api/v1 plugin tree would silently leave those routes on
  // Fastify's default (differently-shaped) error output.
  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const htmlNavigation = ['GET', 'HEAD'].includes(request.method) && !path.extname(pathname);
    if (htmlNavigation && pathname.startsWith('/admin/') && fs.existsSync(path.join(adminPublicPath, 'index.html'))) {
      return reply.type('text/html').send(fs.readFileSync(path.join(adminPublicPath, 'index.html'), 'utf8'));
    }
    if (
      htmlNavigation && pathname.startsWith('/webapp/') &&
      fs.existsSync(path.join(webappPublicPath, 'index.html'))
    ) {
      return reply.type('text/html').send(fs.readFileSync(path.join(webappPublicPath, 'index.html'), 'utf8'));
    }
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    // Fastify validation / rate-limit / other framework errors carry a statusCode.
    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      reply.status(statusCode).send({
        error: { code: error.code ?? 'BAD_REQUEST', message: error.message },
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' },
    });
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/webapp/')) {
      reply.removeHeader('x-frame-options');
      reply.header('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org");
    }
  });
  if (fs.existsSync(adminPublicPath)) {
    await app.register(fastifyStatic, {
      root: adminPublicPath,
      prefix: '/admin/',
      decorateReply: false,
    });

    app.get('/admin', (req, reply) => {
      return reply.redirect('/admin/');
    });
  }

  if (fs.existsSync(webappPublicPath)) {
    await app.register(fastifyStatic, {
      root: webappPublicPath,
      prefix: '/webapp/',
      decorateReply: false,
    });

    app.get('/webapp', (req, reply) => {
      return reply.redirect('/webapp/');
    });
    app.get('/superapp', (req, reply) => {
      return reply.redirect('/webapp/');
    });
    app.get('/superapp/', (req, reply) => reply.redirect('/webapp/'));
    app.get('/', (_req, reply) => reply.redirect('/webapp/'));
  }
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    // @fastify/cors defaults to GET,HEAD,POST only — every admin PATCH/DELETE
    // and mobile PATCH call would otherwise fail CORS preflight silently.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });
  // Payme's JSON-RPC body is JSON (parsed by Fastify's built-in parser);
  // Click's Prepare/Complete calls are application/x-www-form-urlencoded,
  // which needs this plugin.
  await app.register(formbody);
  await app.register(prismaPlugin);

  // Unversioned operational endpoints — load balancers/orchestrators should
  // not need to know about API versioning.
  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(gamesRoutes);
      await api.register(promotionsRoutes);
      await api.register(promoCodesRoutes);
      await api.register(ordersRoutes);
      await api.register(paymentsRoutes);
      await api.register(
        async (payments) => {
          await payments.register(paymeWebhookRoutes);
          await payments.register(clickWebhookRoutes);
          await payments.register(humoWebhookRoutes);
        },
        { prefix: '/payments' },
      );
      await api.register(savedGamesRoutes);
      await api.register(walletRoutes);
      await api.register(topupRoutes);
      await api.register(notificationsRoutes);
      await api.register(telegramRoutes);
      await api.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: `/api/${env.API_VERSION}` },
  );

  return app;
}
