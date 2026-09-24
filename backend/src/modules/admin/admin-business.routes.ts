import type { FastifyInstance } from 'fastify';
import { validateBody, validateQuery } from '../../lib/validate.js';
import { requireAdminRole } from './admin.middleware.js';
import {
  adminCreateAdminSchema,
  adminCreateGameSchema,
  adminCreateGameServerSchema,
  adminCreateProductSchema,
  adminCreatePromoCodeSchema,
  adminCreateProviderProductSchema,
  adminCreateReceivingMethodSchema,
  adminListAuditLogsQuerySchema,
  adminListGamesQuerySchema,
  adminListOrdersQuerySchema,
  adminListProductsQuerySchema,
  adminListQuerySchema,
  adminListTopUpsQuerySchema,
  adminRefundOrderSchema,
  adminRejectTopUpSchema,
  adminSearchUsersQuerySchema,
  adminStatsQuerySchema,
  adminUpdateAdminSchema,
  adminUpdateGameSchema,
  adminUpdateGameServerSchema,
  adminUpdateProductSchema,
  adminUpdatePromoCodeSchema,
  adminUpdateProviderProductSchema,
  adminUpdateProviderSchema,
  adminUpdateReceivingMethodSchema,
  adminUpdateUserDiscountSchema,
  adminWalletAdjustSchema,
} from './admin.schemas.js';
import * as adminService from './admin.service.js';
import type {
  AdminCreateAdminInput,
  AdminCreateGameInput,
  AdminCreateGameServerInput,
  AdminCreateProductInput,
  AdminCreatePromoCodeInput,
  AdminCreateProviderProductInput,
  AdminCreateReceivingMethodInput,
  AdminListAuditLogsQuery,
  AdminListGamesQuery,
  AdminListOrdersQuery,
  AdminListProductsQuery,
  AdminListQuery,
  AdminListTopUpsQuery,
  AdminRefundOrderInput,
  AdminRejectTopUpInput,
  AdminSearchUsersQuery,
  AdminStatsQuery,
  AdminUpdateAdminInput,
  AdminUpdateGameInput,
  AdminUpdateGameServerInput,
  AdminUpdateProductInput,
  AdminUpdatePromoCodeInput,
  AdminUpdateProviderInput,
  AdminUpdateProviderProductInput,
  AdminUpdateReceivingMethodInput,
  AdminUpdateUserDiscountInput,
  AdminWalletAdjustInput,
} from './admin.schemas.js';

const FINANCE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const OPS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];
const TOPUP_REVIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT'];
const AUDIT_READ_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const CATALOG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'CONTENT_MANAGER'];

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

  app.patch<{ Params: { id: string } }>(
    '/users/:id/discount',
    { preHandler: [requireAdminRole(...FINANCE_ROLES), validateBody(adminUpdateUserDiscountSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateUserDiscountInput;
      return adminService.updateUserDiscountAdmin(
        ctx,
        request.currentAdmin!.id,
        request.params.id,
        body.discountPercent,
      );
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

  // --- Promo codes --------------------------------------------------------

  app.get('/promo-codes', { preHandler: requireAdminRole(...FINANCE_ROLES) }, async () => {
    const promoCodes = await adminService.listPromoCodesAdmin(ctx);
    return { promoCodes };
  });

  app.post(
    '/promo-codes',
    { preHandler: [requireAdminRole(...FINANCE_ROLES), validateBody(adminCreatePromoCodeSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreatePromoCodeInput;
      const created = await adminService.createPromoCodeAdmin(ctx, request.currentAdmin!.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/promo-codes/:id',
    { preHandler: [requireAdminRole(...FINANCE_ROLES), validateBody(adminUpdatePromoCodeSchema)] },
    async (request) => {
      const body = request.body as AdminUpdatePromoCodeInput;
      return adminService.updatePromoCodeAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // --- Games & servers --------------------------------------------------------

  app.get('/games', { preHandler: validateQuery(adminListGamesQuerySchema) }, async (request) => {
    const query = request.query as AdminListGamesQuery;
    const games = await adminService.listGamesAdmin(ctx, query);
    return { games };
  });

  app.post(
    '/games',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminCreateGameSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateGameInput;
      const created = await adminService.createGameAdmin(ctx, request.currentAdmin!.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/games/:id',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminUpdateGameSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateGameInput;
      return adminService.updateGameAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  app.get<{ Params: { id: string } }>('/games/:id/servers', async (request) => {
    const servers = await adminService.listGameServersAdmin(ctx, request.params.id);
    return { servers };
  });

  app.post<{ Params: { id: string } }>(
    '/games/:id/servers',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminCreateGameServerSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateGameServerInput;
      const created = await adminService.createGameServerAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/game-servers/:id',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminUpdateGameServerSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateGameServerInput;
      return adminService.updateGameServerAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // --- Products -------------------------------------------------------------

  app.get('/products', { preHandler: validateQuery(adminListProductsQuerySchema) }, async (request) => {
    const query = request.query as AdminListProductsQuery;
    const products = await adminService.listProductsAdmin(ctx, query.gameId);
    return { products };
  });

  app.post(
    '/products',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminCreateProductSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateProductInput;
      const created = await adminService.createProductAdmin(ctx, request.currentAdmin!.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminUpdateProductSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateProductInput;
      return adminService.updateProductAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  app.get('/providers', async () => {
    const providers = await adminService.getProviderStatsAdmin(ctx);
    return { providers };
  });

  app.patch<{ Params: { id: string } }>(
    '/providers/:id',
    { preHandler: [requireAdminRole('SUPER_ADMIN', 'ADMIN'), validateBody(adminUpdateProviderSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateProviderInput;
      return adminService.updateProviderAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  // Which provider(s) actually fulfill a given product — a product only
  // gets real nickname-checks/fulfillment once one of these points at a
  // credentialed, active provider (see providers/registry.ts).
  app.get<{ Params: { id: string } }>('/products/:id/provider-mappings', async (request) => {
    const mappings = await adminService.listProviderProductsForProductAdmin(ctx, request.params.id);
    return { mappings };
  });

  app.post<{ Params: { id: string } }>(
    '/products/:id/provider-mappings',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminCreateProviderProductSchema)] },
    async (request, reply) => {
      const body = request.body as AdminCreateProviderProductInput;
      const created = await adminService.createProviderProductAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
      return reply.status(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/provider-mappings/:id',
    { preHandler: [requireAdminRole(...CATALOG_ROLES), validateBody(adminUpdateProviderProductSchema)] },
    async (request) => {
      const body = request.body as AdminUpdateProviderProductInput;
      return adminService.updateProviderProductAdmin(ctx, request.currentAdmin!.id, request.params.id, body);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/provider-mappings/:id',
    { preHandler: requireAdminRole(...CATALOG_ROLES) },
    async (request, reply) => {
      await adminService.deleteProviderProductAdmin(ctx, request.currentAdmin!.id, request.params.id);
      return reply.status(204).send();
    },
  );

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

  // --- Catalog & Providers Sync ------------------------------------------------
  app.post(
    '/system/sync-catalog',
    { preHandler: requireAdminRole('SUPER_ADMIN') },
    async (request) => {
      return adminService.syncCatalogAdmin(ctx, request.currentAdmin!.id);
    },
  );
  app.post(
    '/system/sync-resellcodes-prices',
    { preHandler: requireAdminRole('SUPER_ADMIN', 'ADMIN') },
    async (request) => adminService.syncReSellCodesPricesAdmin(ctx, request.currentAdmin!.id),
  );
}
