import { describe, expect, it } from 'vitest';
import { parseHumoMessage } from '../src/lib/humo-message-parser.js';

describe('parseHumoMessage', () => {
  it('parses the real @HUMOcardbot message format', () => {
    const text = ['Пополнение', '1.000,00 UZS', 'NBU P2P HUMOHUMO>tas', 'HUMOCARD *8882', '17:16 25.08.2026'].join(
      '\n',
    );
    expect(parseHumoMessage(text)).toEqual({ cardHint: '8882', amountMinor: 100_000 });
  });

  it('parses an amount with no thousands separator', () => {
    const text = '500,00 UZS\nHUMOCARD *1234\n10:00 01.01.2026';
    expect(parseHumoMessage(text)).toEqual({ cardHint: '1234', amountMinor: 50_000 });
  });

  it('parses a large amount with dot thousands separators', () => {
    const text = '12.345.678,50 so\'m\nHUMOCARD *9999\n10:00 01.01.2026';
    expect(parseHumoMessage(text)).toEqual({ cardHint: '9999', amountMinor: 1_234_567_850 });
  });

  it('does not misread the message date as the card number when no explicit marker is present', () => {
    // No "karta"/"card"/"№"/"*" anywhere — only the date's own digits are
    // available, so this must fail to parse a card hint rather than
    // silently grabbing "2026" from the trailing date.
    const text = '1.000,00 UZS\nsome other line\n17:16 25.08.2026';
    expect(parseHumoMessage(text)).toBeNull();
  });

  it('still finds a card hint via the bare-digits fallback when a real card number is present without a marker', () => {
    const text = '1.000,00 UZS\n8882\n17:16 25.08.2026';
    expect(parseHumoMessage(text)).toEqual({ cardHint: '8882', amountMinor: 100_000 });
  });

  it('returns null for a message with no currency marker', () => {
    expect(parseHumoMessage('Random unrelated message with 1234 in it')).toBeNull();
  });

  it('returns null for a message with no card digits', () => {
    expect(parseHumoMessage('1.000,00 UZS received, thanks!')).toBeNull();
  });

  it('returns null for a zero or malformed amount', () => {
    expect(parseHumoMessage('0,00 UZS\nHUMOCARD *8882')).toBeNull();
  });
});
