import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { validateQuery } from '../../lib/validate.js';
import { listWalletTransactionsQuerySchema } from './wallet.schemas.js';
import * as walletService from './wallet.service.js';
import type { ListWalletTransactionsQuery } from './wallet.schemas.js';

/** The customer's own wallet — balance + transaction history. Money movement itself happens via orders/top-ups, not directly here. */
export async function walletRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };

  app.get('/wallet', { preHandler: authenticate }, async (request) => {
    return walletService.getWalletSummary(ctx, request.currentUser!.id);
  });

  app.get(
    '/wallet/transactions',
    { preHandler: [authenticate, validateQuery(listWalletTransactionsQuerySchema)] },
    async (request) => {
      const query = request.query as ListWalletTransactionsQuery;
      const transactions = await walletService.listWalletTransactions(ctx, request.currentUser!.id, query.limit);
      return { transactions };
    },
  );
}
