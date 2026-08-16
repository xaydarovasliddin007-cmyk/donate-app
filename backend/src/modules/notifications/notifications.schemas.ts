import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
