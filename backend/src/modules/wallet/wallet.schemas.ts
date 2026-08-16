import { z } from 'zod';

export const listWalletTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export type ListWalletTransactionsQuery = z.infer<typeof listWalletTransactionsQuerySchema>;
