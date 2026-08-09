import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
    .optional(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
