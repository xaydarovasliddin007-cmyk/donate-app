import { describe, expect, it } from 'vitest';
import { applyDiscount } from '../src/lib/money.js';

describe('applyDiscount', () => {
  it('returns the amount unchanged at 0%', () => {
    expect(applyDiscount(96_00000, 0)).toBe(96_00000);
  });

  it('returns 0 at 100% or above (never negative, never over-discounted)', () => {
    expect(applyDiscount(96_00000, 100)).toBe(0);
    expect(applyDiscount(96_00000, 150)).toBe(0);
  });

  it('rounds down in the customer\'s favor, never up', () => {
    // 33% of 10 000 so'm = 3 300 minor units off exactly -> 6 700 so'm charged.
    expect(applyDiscount(10000_00, 33)).toBe(6700_00);
    // A discount that doesn't divide evenly must round the *charge* down,
    // not up — 10% off 333 minor units is 299.7, must floor to 299, not 300.
    expect(applyDiscount(333, 10)).toBe(299);
  });

  it('never returns more than the original amount for any percent in range', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      expect(applyDiscount(123_45, pct)).toBeLessThanOrEqual(123_45);
      expect(applyDiscount(123_45, pct)).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a zero amount without dividing by zero or erroring', () => {
    expect(applyDiscount(0, 50)).toBe(0);
  });
});
