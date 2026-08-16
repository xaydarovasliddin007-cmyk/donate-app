import { z } from 'zod';

export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  providerCode: z.string().trim().min(1).default('DEV_MOCK_PAYMENT'),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const simulateWebhookSchema = z.object({
  outcome: z.enum(['SUCCEEDED', 'FAILED']),
});

export const payWithWalletSchema = z.object({
  orderId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type SimulateWebhookInput = z.infer<typeof simulateWebhookSchema>;
export type PayWithWalletInput = z.infer<typeof payWithWalletSchema>;
