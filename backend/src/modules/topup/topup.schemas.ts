import { z } from 'zod';

export const createTopUpRequestSchema = z.object({
  receivingMethodId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  userReference: z.string().trim().min(1).max(200).optional(),
});

export const reserveTopUpRequestSchema = z.object({
  amountMinor: z.number().int().positive(),
  // Which kind of receiving method to reserve against — omitted means any
  // active type (today's behavior, when only CARD_TRANSFER exists).
  type: z.enum(['CARD_TRANSFER', 'QR_CODE', 'PAYNET_TERMINAL']).optional(),
  channel: z.enum(['HUMO', 'UZCARD', 'BANKOMAT']).optional(),
}).refine((data) => !data.channel || !data.type || (
  data.channel === 'BANKOMAT' ? data.type === 'PAYNET_TERMINAL' : data.type === 'CARD_TRANSFER'
), { message: 'type does not match channel', path: ['type'] });

export const submitTopUpReferenceSchema = z.object({
  userReference: z.string().trim().min(1).max(200),
});

export const listTopUpRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

// What the Telegram listener script (scripts/humo-listener.ts) posts once it
// parses a bank notification message — cardHint is whatever trailing digits
// the message revealed (matched against ReceivingMethod.cardNumber's
// own trailing digits, not stored/compared as a full PAN).
export const humoTransactionSchema = z.object({
  transactionId: z.string().trim().min(1).max(128),
  cardHint: z.string().trim().min(4).max(19),
  amountMinor: z.number().int().positive(),
  rawMessage: z.string().trim().max(2000).optional(),
});

export type CreateTopUpRequestInput = z.infer<typeof createTopUpRequestSchema>;
export type ReserveTopUpRequestInput = z.infer<typeof reserveTopUpRequestSchema>;
export type ListTopUpRequestsQuery = z.infer<typeof listTopUpRequestsQuerySchema>;
export type HumoTransactionInput = z.infer<typeof humoTransactionSchema>;
export type SubmitTopUpReferenceInput = z.infer<typeof submitTopUpReferenceSchema>;
