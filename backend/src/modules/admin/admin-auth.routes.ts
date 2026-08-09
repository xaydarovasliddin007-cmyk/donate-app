import type { FastifyInstance } from 'fastify';
import { validateBody } from '../../lib/validate.js';
import { adminLoginSchema, adminRefreshSchema } from './admin-auth.schemas.js';
import * as adminAuthService from './admin-auth.service.js';
import type { AdminLoginInput, AdminRefreshInput } from './admin-auth.schemas.js';

/** Public admin auth endpoints — login/refresh/logout need no prior admin session. Everything else under /admin does. */
export async function adminAuthRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.post(
    '/auth/login',
    {
      // Tighter than the global default — admin login is the highest-value
      // brute-force target in the whole API.
      config: { rateLimit: { max: 10, timeWindow: 60_000 } },
      preHandler: validateBody(adminLoginSchema),
    },
    async (request) => {
      const body = request.body as AdminLoginInput;
      return adminAuthService.adminLogin(ctx, body);
    },
  );

  app.post('/auth/refresh', { preHandler: validateBody(adminRefreshSchema) }, async (request) => {
    const body = request.body as AdminRefreshInput;
    return adminAuthService.adminRefresh(ctx, body.refreshToken);
  });

  app.post('/auth/logout', { preHandler: validateBody(adminRefreshSchema) }, async (request, reply) => {
    const body = request.body as AdminRefreshInput;
    await adminAuthService.adminLogout(ctx, body.refreshToken);
    return reply.status(204).send();
  });
}
