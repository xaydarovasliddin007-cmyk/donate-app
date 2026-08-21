import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const googleAuthSchema = z.object({
  // The raw Google ID token (JWT) from the Flutter google_sign_in flow —
  // never trusted as-is, always re-verified server-side against Google.
  idToken: z.string().min(1),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
