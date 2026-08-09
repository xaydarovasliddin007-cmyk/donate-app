import type { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    currentUser?: {
      id: string;
      role: string;
    };
    currentAdmin?: {
      id: string;
      role: string;
    };
  }
}
