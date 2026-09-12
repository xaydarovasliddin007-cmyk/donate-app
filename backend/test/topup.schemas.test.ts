import { describe, expect, it } from 'vitest';
import {
  createTopUpRequestSchema,
  humoTransactionSchema,
  reserveTopUpRequestSchema,
  submitTopUpReferenceSchema,
} from '../src/modules/topup/topup.schemas.js';

describe('TopUp Schemas Validation', () => {
  describe('reserveTopUpRequestSchema', () => {
    it('accepts valid amount without type', () => {
      const result = reserveTopUpRequestSchema.safeParse({ amountMinor: 50_000_00 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountMinor).toBe(50_000_00);
        expect(result.data.type).toBeUndefined();
      }
    });

    it('accepts valid amount with CARD_TRANSFER type', () => {
      const result = reserveTopUpRequestSchema.safeParse({
        amountMinor: 100_000_00,
        type: 'CARD_TRANSFER',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid amount with QR_CODE type', () => {
      const result = reserveTopUpRequestSchema.safeParse({
        amountMinor: 25_000_00,
        type: 'QR_CODE',
      });
      expect(result.success).toBe(true);
    });

    it('rejects zero or negative amounts', () => {
      expect(reserveTopUpRequestSchema.safeParse({ amountMinor: 0 }).success).toBe(false);
      expect(reserveTopUpRequestSchema.safeParse({ amountMinor: -1000 }).success).toBe(false);
    });

    it('rejects fractional float minor amounts', () => {
      expect(reserveTopUpRequestSchema.safeParse({ amountMinor: 5000.5 }).success).toBe(false);
    });

    it('rejects invalid receiving method types', () => {
      expect(
        reserveTopUpRequestSchema.safeParse({
          amountMinor: 50_000_00,
          type: 'CRYPTO_USDT',
        }).success,
      ).toBe(false);
    });
  });

  describe('humoTransactionSchema', () => {
    it('accepts valid transaction input with card hint and amount', () => {
      const result = humoTransactionSchema.safeParse({
        cardHint: '8882',
        amountMinor: 100_000,
        rawMessage: 'Пополнение 1.000,00 UZS',
      });
      expect(result.success).toBe(true);
    });

    it('rejects card hint shorter than 4 digits', () => {
      const result = humoTransactionSchema.safeParse({
        cardHint: '12',
        amountMinor: 100_000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive transaction amounts', () => {
      expect(humoTransactionSchema.safeParse({ cardHint: '8882', amountMinor: 0 }).success).toBe(false);
      expect(humoTransactionSchema.safeParse({ cardHint: '8882', amountMinor: -500 }).success).toBe(false);
    });
  });

  describe('submitTopUpReferenceSchema', () => {
    it('accepts valid terminal receipt reference', () => {
      const result = submitTopUpReferenceSchema.safeParse({
        userReference: 'REC-2026-987654',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userReference).toBe('REC-2026-987654');
      }
    });

    it('rejects empty or whitespace-only references', () => {
      expect(submitTopUpReferenceSchema.safeParse({ userReference: '' }).success).toBe(false);
      expect(submitTopUpReferenceSchema.safeParse({ userReference: '   ' }).success).toBe(false);
    });
  });

  describe('createTopUpRequestSchema', () => {
    it('requires a valid UUID for receivingMethodId', () => {
      expect(
        createTopUpRequestSchema.safeParse({
          receivingMethodId: 'not-a-uuid',
          amountMinor: 50_000_00,
        }).success,
      ).toBe(false);

      expect(
        createTopUpRequestSchema.safeParse({
          receivingMethodId: '123e4567-e89b-12d3-a456-426614174000',
          amountMinor: 50_000_00,
        }).success,
      ).toBe(true);
    });
  });
});
