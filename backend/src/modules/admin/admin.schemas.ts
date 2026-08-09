import { z } from 'zod';

const orderStatusValues = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;

export const adminListOrdersQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const adminListProductsQuerySchema = z.object({
  gameId: z.string().uuid().optional(),
});

export const adminUpdateProductSchema = z
  .object({
    isActive: z.boolean().optional(),
    amountMinor: z.number().int().positive().optional(),
  })
  .refine((data) => data.isActive !== undefined || data.amountMinor !== undefined, {
    message: 'At least one of isActive or amountMinor must be provided',
  });

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminListProductsQuery = z.infer<typeof adminListProductsQuerySchema>;
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;
