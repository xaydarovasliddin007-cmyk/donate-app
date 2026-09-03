/** Formats integer minor units for plain-text contexts (Telegram alerts, logs) — never for money math. */
export function formatMinorAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${major.toLocaleString('en-US')} ${currency}`;
}

/**
 * Applies a whole-percent discount to a minor-unit amount, rounding down —
 * always in the customer's favor, and the only rounding direction that
 * guarantees the result never exceeds what a 100% discount would give
 * (i.e. never negative, never above the original amount). Used for
 * reseller/partner accounts' standing purchase discount
 * (User.discountPercent) — see orders.service.ts.
 */
export function applyDiscount(amountMinor: number, discountPercent: number): number {
  if (discountPercent <= 0) return amountMinor;
  if (discountPercent >= 100) return 0;
  return Math.floor((amountMinor * (100 - discountPercent)) / 100);
}
