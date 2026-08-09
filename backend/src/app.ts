import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    trustProxy: true,
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });
  await app.register(prismaPlugin);

  // Unversioned operational endpoints — load balancers/orchestrators should
  // not need to know about API versioning.
  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(authRoutes);
    },
    { prefix: `/api/${env.API_VERSION}` },
  );

  app.setNotFoundHandler((request, reply) => {
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

  return app;
}
