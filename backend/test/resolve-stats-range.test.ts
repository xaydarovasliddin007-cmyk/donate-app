import { describe, expect, it } from 'vitest';
import { resolveStatsRange } from '../src/modules/admin/admin.service.js';

describe('resolveStatsRange', () => {
  it('today resolves to start-of-day through now', () => {
    const { from, to } = resolveStatsRange({ range: 'today' });
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });

  it('7d/30d/90d each resolve to the expected number of days back from start-of-day', () => {
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

    const sevenDays = resolveStatsRange({ range: '7d' });
    expect(startOfToday - sevenDays.from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    const thirtyDays = resolveStatsRange({ range: '30d' });
    expect(startOfToday - thirtyDays.from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);

    const ninetyDays = resolveStatsRange({ range: '90d' });
    expect(startOfToday - ninetyDays.from.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('custom uses the provided bounds, defaulting missing ones to epoch/now', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');
    const result = resolveStatsRange({ range: 'custom', from, to });
    expect(result.from).toEqual(from);
    expect(result.to).toEqual(to);

    const defaulted = resolveStatsRange({ range: 'custom' });
    expect(defaulted.from.getTime()).toBe(0);
    expect(defaulted.to.getTime()).toBeGreaterThan(0);
  });
});
