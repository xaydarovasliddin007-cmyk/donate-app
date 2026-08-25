import { z } from 'zod';

export const createTopUpRequestSchema = z.object({
  receivingMethodId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  userReference: z.string().trim().min(1).max(200).optional(),
});

export const reserveTopUpRequestSchema = z.object({
  amountMinor: z.number().int().positive(),
});

export const listTopUpRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

// What the Telegram listener script (scripts/humo-listener.ts) posts once it
// parses a bank notification message — cardHint is whatever trailing digits
// the message revealed (matched against ReceivingMethod.cardNumberMasked's
// own trailing digits, not stored/compared as a full PAN).
export const humoTransactionSchema = z.object({
  cardHint: z.string().trim().min(4).max(19),
  amountMinor: z.number().int().positive(),
  rawMessage: z.string().trim().max(2000).optional(),
});

export type CreateTopUpRequestInput = z.infer<typeof createTopUpRequestSchema>;
export type ReserveTopUpRequestInput = z.infer<typeof reserveTopUpRequestSchema>;
export type ListTopUpRequestsQuery = z.infer<typeof listTopUpRequestsQuerySchema>;
export type HumoTransactionInput = z.infer<typeof humoTransactionSchema>;
