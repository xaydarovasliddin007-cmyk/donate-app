import { z } from 'zod';

export const createTopUpRequestSchema = z.object({
  receivingMethodId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  userReference: z.string().trim().min(1).max(200).optional(),
});

export const listTopUpRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export type CreateTopUpRequestInput = z.infer<typeof createTopUpRequestSchema>;
export type ListTopUpRequestsQuery = z.infer<typeof listTopUpRequestsQuerySchema>;
