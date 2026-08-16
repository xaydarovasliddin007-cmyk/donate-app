import type { FastifyInstance } from 'fastify';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { requireAdminRole } from './admin.middleware.js';
import {
  adminCreateAdminSchema,
  adminCreateReceivingMethodSchema,
  adminListAuditLogsQuerySchema,
  adminListOrdersQuerySchema,
  adminListProductsQuerySchema,
  adminListQuerySchema,
  adminListTopUpsQuerySchema,
  adminRefundOrderSchema,
  adminRejectTopUpSchema,
  adminSearchUsersQuerySchema,
  adminStatsQuerySchema,
  adminUpdateAdminSchema,
  adminUpdateProductSchema,
  adminUpdateReceivingMethodSchema,
  adminWalletAdjustSchema,
} from './admin.schemas.js';
import * as adminService from './admin.service.js';
import type {
  AdminCreateAdminInput,
  AdminCreateReceivingMethodInput,
  AdminListAuditLogsQuery,
  AdminListOrdersQuery,
  AdminListProductsQuery,
  AdminListQuery,
  AdminListTopUpsQuery,
  AdminRefundOrderInput,
  AdminRejectTopUpInput,
  AdminSearchUsersQuery,
  AdminStatsQuery,
  AdminUpdateAdminInput,
  AdminUpdateProductInput,
  AdminUpdateReceivingMethodInput,
  AdminWalletAdjustInput,
} from './admin.schemas.js';

const FINANCE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const OPS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];
const TOPUP_REVIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'];
const AUDIT_READ_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** Everything here requires an authenticated admin session — see admin.routes.ts for the auth hook. */
export async function adminBusinessRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/auth/me', async (request) => {
    const admin = await app.prisma.adminUser.findUniqueOrThrow({ where: { id: request.currentAdmin!.id } });
    return { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role };
  });

  // --- Orders ---------------------------------------------------------------

  app.get('/orders', { preHandler: validateQuery(adminListOrdersQuerySchema) }, async (request) => {
    const query = request.query as AdminListOrdersQuery;
    return adminService.listOrdersAdmin(ctx, query);
  });

  app.get<{ Params: { id: string } }>('/orders/:id', async (request) => {
    return adminService.getOrderAdmin(ctx, request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    '/orders/:id/retry-fulfillment',
    { preHandler: requireAdminRole(...OPS_ROLES) },
    async (request) => {
      return adminService.retryOrderFulfillmentAdmin(ctx, request.currentAdmin!.id, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/orders/:id/refund',
    { preHandler: [requireAdminRole(...FINANCE_ROLES), validateBody(adminRefundOrderSchema)] },
    async (request) => {
      const body = request.body as AdminRefundOrderInput;
      return adminService.refundOrderAdmin(ctx, request.currentAdmin!.id, request.params.id, body.reason);
    },
  );

  // --- Users ------------------------------------------------------------------

  app.get('/users', { preHandler: validateQuery(adminSearchUsersQuerySchema) }, async (request) => {
    const query = request.query as AdminSearchUsersQuery;
    return adminService.listUsersAdmin(ctx, query);
  });

  app.get<{ Params: { id: string } }>('/users/:id', async (request) => {
    return adminService.getUserDetailAdmin(ctx, request.params.id);
  });

  // --- Wallet -----------------------------------------------------------------

  app.get<{ Params: { id: string } }>('/users/:id/wallet', async (request) => {
    return adminService.getUserWalletAdmin(ctx, request.params.id);
  });

  app.get<{ Params: { id: string } }>(
    '/users/:id/wallet/transactions',
    { preHandler: validateQuery(adminListQuerySchema) },
    async (request) => {
      const query = request.query as AdminListQuery;
      const transactions = await adminService.listUserWalletTransactionsAdmin(ctx, request.params.id, query.limit);
      return { transactions };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/users/:id/wallet/adjust',
    { preHandler: [requireAdminRole(...FINANCE_ROLES), validateBody(adminWalletAdjustSchema)] },
    async (request) => {
      const body = request.body as AdminWalletAdjustInput;
      return adminService.adjustWalletAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // --- Top-ups ------------------------------------------------------------------

  app.get('/topups', { preHandler: validateQuery(adminListTopUpsQuerySchema) }, async (request) => {
    const query = request.query as AdminListTopUpsQuery;
    const topUps = await adminService.listTopUpsAdmin(ctx, query);
    return { topUps };
  });

  app.post<{ Params: { id: string } }>(
    '/topups/:id/verify',
    { preHandler: requireAdminRole(...TOPUP_REVIEW_ROLES) },
    async (request) => {
      return adminService.verifyTopUpAdmin(ctx, request.currentAdmin!.id, request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/topups/:id/reject',
    { preHandler: [requireAdminRole(...TOPUP_REVIEW_ROLES), validateBody(adminRejectTopUpSchema)] },
    async (request) => {
      const body = request.body as AdminRejectTopUpInput;
      return adminService.rejectTopUpAdmin(ctx, request.currentAdmin!.id, request.params.id, body.rejectionReason);
    },
  );

  // --- Receiving methods (UZDONATE card-transfer top-up config) -------------

  app.get('/receiving-methods', async () => {
    const receivingMethods = await adminService.listReceivingMethodsAdmin(ctx);
    return { receivingMethods };
  });

  app.post(
    '/receiving-methods',
    { preHandler: [requireAdminRole('SUPER_ADMIN', 'ADMIN'), validateBody(adminCreateReceivingMethodSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateReceivingMethodInput;
      const created = await adminService.createReceivingMethodAdmin(ctx, request.currentAdmin!.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/receiving-methods/:id',
    { preHandler: [requireAdminRole('SUPER_ADMIN', 'ADMIN'), validateBody(adminUpdateReceivingMethodSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateReceivingMethodInput;
      return adminService.updateReceivingMethodAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // --- Products -------------------------------------------------------------

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
    const providers = await adminService.getProviderStatsAdmin(ctx);
    return { providers };
  });

  app.get<{ Params: { id: string } }>('/payments/:id', async (request) => {
    return adminService.getPaymentAdmin(ctx, request.params.id);
  });

  // --- Refunds (read-only view over REFUND-type wallet ledger entries) -------

  app.get('/refunds', { preHandler: validateQuery(adminListQuerySchema) }, async (request) => {
    const query = request.query as AdminListQuery;
    const refunds = await adminService.listRefundsAdmin(ctx, query);
    return { refunds };
  });

  app.get('/stats', { preHandler: validateQuery(adminStatsQuerySchema) }, async (request) => {
    const query = request.query as AdminStatsQuery;
    const range = adminService.resolveStatsRange(query);
    return adminService.getStatsAdmin(ctx, range);
  });

  // --- Admin management (RBAC) — SUPER_ADMIN only ----------------------------

  app.get('/admins', { preHandler: requireAdminRole('SUPER_ADMIN') }, async () => {
    const admins = await adminService.listAdminsAdmin(ctx);
    return { admins };
  });

  app.post(
    '/admins',
    { preHandler: [requireAdminRole('SUPER_ADMIN'), validateBody(adminCreateAdminSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateAdminInput;
      const created = await adminService.createAdminAdmin(ctx, request.currentAdmin!.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/admins/:id',
    { preHandler: [requireAdminRole('SUPER_ADMIN'), validateBody(adminUpdateAdminSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateAdminInput;
      return adminService.updateAdminAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // --- Audit logs (read-only) --------------------------------------------------

  app.get(
    '/audit-logs',
    { preHandler: [requireAdminRole(...AUDIT_READ_ROLES), validateQuery(adminListAuditLogsQuerySchema)] },
    async (request) => {
      const query = request.query as AdminListAuditLogsQuery;
      const auditLogs = await adminService.listAuditLogsAdmin(ctx, query);
      return { auditLogs };
    },
  );
}
