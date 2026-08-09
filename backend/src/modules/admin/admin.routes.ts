import type { FastifyInstance } from 'fastify';
import { authenticateAdmin } from './admin.middleware.js';
import { adminAuthRoutes } from './admin-auth.routes.js';
import { adminBusinessRoutes } from './admin-business.routes.js';

/**
 * Everything under /api/v1/admin. Admin access tokens are signed/verified
 * with their own secret (ADMIN_JWT_ACCESS_SECRET, see admin-token.ts) —
 * entirely independent of the customer-facing JWT registered in app.ts.
 */
export async function adminRoutes(app: FastifyInstance) {
  // Public: login/refresh/logout need no prior admin session.
  await app.register(adminAuthRoutes);

  // Protected: everything else requires a verified admin-scoped access token.
  await app.register(async (protectedApi) => {
    protectedApi.addHook('preHandler', authenticateAdmin);
    await protectedApi.register(adminBusinessRoutes);
  });
}
