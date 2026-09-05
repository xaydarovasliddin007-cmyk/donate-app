/**
 * Parser for @HUMOcardbot's notification text (see scripts/humo-listener.ts).
 * Calibrated against a real message:
 *   Пополнение
 *   1.000,00 UZS
 *   NBU P2P HUMOHUMO>tas
 *   HUMOCARD *8882
 *   17:16 25.08.2026
 * — dot is the thousands separator, comma introduces the 2-digit tiyin
 * part (European-style formatting, not the "1,000.00" US style the first
 * pass assumed — that mismatch was silently multiplying every amount by
 * 100). A message that fails to parse is simply skipped (logged, not
 * forwarded) — that top-up just waits for manual admin review, it never
 * causes a wrong credit.
 */
export function parseHumoMessage(text: string): { cardHint: string; amountMinor: number } | null {
  // Amount: an integer part with optional space/dot thousands separators,
  // an optional ",NN" tiyin part, followed by a currency marker so we
  // don't accidentally match a card number as an amount.
  const amountMatch = text.match(/([\d](?:[\d.\s]*\d)?)(?:,(\d{1,2}))?\s*(?:so'?m|sum|uzs)/i);
  const integerRaw = amountMatch?.[1];
  if (!integerRaw) return null;
  const integerDigits = integerRaw.replace(/[.\s]/g, '');
  if (!integerDigits) return null;
  const fractionRaw = amountMatch![2];
  const fractionTiyin = fractionRaw ? Number(fractionRaw.padEnd(2, '0').slice(0, 2)) : 0;
  const amountMinor = Number(integerDigits) * 100 + fractionTiyin;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null;

  // Card hint: the last group of 4+ digits appearing near "karta"/"card"/
  // "*"/"№". The bare fallback (last 4+-digit group anywhere) strips
  // DD.MM.YYYY-shaped dates first — the message's own timestamp line ends
  // in a 4-digit year, which would otherwise get misread as the card
  // number on any message that doesn't use one of the explicit markers.
  const textWithoutDates = text.replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '');
  const cardMatch =
    text.match(/(?:karta|card|№|\*)\D{0,10}(\d{4,})/i) ?? [...textWithoutDates.matchAll(/(\d{4,})/g)].pop();
  const cardHint = cardMatch?.[1]?.slice(-4);
  if (!cardHint || cardHint.length < 4) return null;

  return { cardHint, amountMinor };
}
