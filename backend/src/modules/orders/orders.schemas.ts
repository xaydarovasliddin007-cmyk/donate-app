import { z } from 'zod';

export const createOrderSchema = z.object({
  gameId: z.string().uuid(),
  productId: z.string().uuid(),
  playerId: z.string().trim().min(1).max(64),
  serverId: z.string().trim().min(1).max(64).optional(),
  // Client generates one UUID per checkout attempt (kept stable across
  // retries of the same tap) so a flaky connection can never double-charge.
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
});

// Pre-checkout "does this player ID exist" check — same resolution path as
// createOrder (game → server → product → provider) so the adapter this
// validates against is guaranteed to be the same one the real order would
// use, but it never creates anything.
export const validatePlayerSchema = z.object({
  gameId: z.string().uuid(),
  productId: z.string().uuid(),
  playerId: z.string().trim().min(1).max(64),
  serverId: z.string().trim().min(1).max(64).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type ValidatePlayerInput = z.infer<typeof validatePlayerSchema>;
