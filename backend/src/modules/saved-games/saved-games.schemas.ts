import { z } from 'zod';

export const upsertSavedGameSchema = z.object({
  playerId: z.string().trim().min(1).max(64),
  serverId: z.string().trim().min(1).max(64).optional(),
  zoneId: z.string().trim().min(1).max(32).optional(),
});

export type UpsertSavedGameInput = z.infer<typeof upsertSavedGameSchema>;
