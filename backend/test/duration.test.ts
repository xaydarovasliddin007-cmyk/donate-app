import { describe, expect, it } from 'vitest';
import { parseDurationMs } from '../src/lib/duration.js';

describe('parseDurationMs', () => {
  it('parses minutes, hours, days', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
    expect(parseDurationMs('1h')).toBe(3_600_000);
    expect(parseDurationMs('30d')).toBe(30 * 86_400_000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationMs('banana')).toThrow();
  });
});
