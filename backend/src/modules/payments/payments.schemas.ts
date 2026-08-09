import { z } from 'zod';

export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  providerCode: z.string().trim().min(1).default('DEV_MOCK_PAYMENT'),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const simulateWebhookSchema = z.object({
  outcome: z.enum(['SUCCEEDED', 'FAILED']),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type SimulateWebhookInput = z.infer<typeof simulateWebhookSchema>;
