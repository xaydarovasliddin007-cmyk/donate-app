import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  // Deliberately not calling $connect() here: Prisma connects lazily on the
  // first query. This lets the process boot and serve /health even if the
  // database is briefly unreachable — /ready reports the real DB state
  // instead of crash-looping the whole app on a transient DB hiccup.
  const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  app.decorate('prisma', prisma);

  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
});
