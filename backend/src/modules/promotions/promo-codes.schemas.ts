import { z } from 'zod';

export const redeemPromoCodeSchema = z.object({
  code: z.string().trim().min(1).max(40),
});

export type RedeemPromoCodeInput = z.infer<typeof redeemPromoCodeSchema>;
