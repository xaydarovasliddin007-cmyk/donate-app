import type { FastifyInstance } from 'fastify';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { requireAdminRole } from './admin.middleware.js';
import {
  adminListOrdersQuerySchema,
  adminListProductsQuerySchema,
  adminListQuerySchema,
  adminUpdateProductSchema,
} from './admin.schemas.js';
import * as adminService from './admin.service.js';
import type {
  AdminListOrdersQuery,
  AdminListProductsQuery,
  AdminListQuery,
  AdminUpdateProductInput,
} from './admin.schemas.js';

/** Everything here requires an authenticated admin session — see admin.routes.ts for the auth hook. */
export async function adminBusinessRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/auth/me', async (request) => {
    const admin = await app.prisma.adminUser.findUniqueOrThrow({ where: { id: request.currentAdmin!.id } });
    return { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role };
  });

  app.get('/orders', { preHandler: validateQuery(adminListOrdersQuerySchema) }, async (request) => {
    const query = request.query as AdminListOrdersQuery;
    const orders = await adminService.listOrdersAdmin(ctx, query);
    return { orders };
  });

  app.get<{ Params: { id: string } }>('/orders/:id', async (request) => {
    return adminService.getOrderAdmin(ctx, request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    '/orders/:id/retry-fulfillment',
    { preHandler: requireAdminRole('SUPER_ADMIN', 'ADMIN', 'OPERATIONS') },
    async (request) => {
      return adminService.retryOrderFulfillmentAdmin(ctx, request.currentAdmin!.id, request.params.id);
    },
  );

  app.get('/users', { preHandler: validateQuery(adminListQuerySchema) }, async (request) => {
    const query = request.query as AdminListQuery;
    const users = await adminService.listUsersAdmin(ctx, query.limit);
    return { users };
  });

  app.get('/products', { preHandler: validateQuery(adminListProductsQuerySchema) }, async (request) => {
    const query = request.query as AdminListProductsQuery;
    const products = await adminService.listProductsAdmin(ctx, query.gameId);
    return { products };
  });

  app.patch<{ Params: { id: string } }>(
    '/products/:id',
    {
      preHandler: [
        requireAdminRole('SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'CONTENT_MANAGER'),
        validateBody(adminUpdateProductSchema),
      ],
    },
    async (request) => {
      const body = request.body as AdminUpdateProductInput;
      return adminService.updateProductAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  app.get('/providers', async () => {
    const providers = await adminService.listProvidersAdmin(ctx);
    return { providers };
  });

  app.get<{ Params: { id: string } }>('/payments/:id', async (request) => {
    return adminService.getPaymentAdmin(ctx, request.params.id);
  });

  app.get('/stats', async () => {
    return adminService.getStatsAdmin(ctx);
  });
}
