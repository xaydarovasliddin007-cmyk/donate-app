import type { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    currentUser?: {
      id: string;
      role: string;
      // The refresh-token row id this access token was issued alongside —
      // absent on older still-valid tokens minted before this field
      // existed, so always optional. See auth.service.ts issueTokenPair().
      sid?: string;
    };
    currentAdmin?: {
      id: string;
      role: string;
    };
  }
}
