import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminRefreshInput = z.infer<typeof adminRefreshSchema>;
