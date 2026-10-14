/** Supplier USD quotes become UZS tiyin, rounded up within Prisma's Int range. */
export function usdToUzsMinor(price: string | number, rate: number): number {
  const decimal = String(price);
  if (!/^\d+(?:\.\d{1,6})?$/.test(decimal) || !Number.isSafeInteger(rate) || rate <= 0) {
    throw new Error('Invalid supplier price or UZS/USD funding rate');
  }
  const [whole = '0', fraction = ''] = decimal.split('.');
  const millionths = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  const minor = (millionths * BigInt(rate) + 9_999n) / 10_000n;
  if (minor <= 0n || minor > 2_147_483_647n) throw new Error('Supplier price is out of range');
  return Number(minor);
}
