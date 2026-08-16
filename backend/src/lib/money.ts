/** Formats integer minor units for plain-text contexts (Telegram alerts, logs) — never for money math. */
export function formatMinorAmount(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${major.toLocaleString('en-US')} ${currency}`;
}
