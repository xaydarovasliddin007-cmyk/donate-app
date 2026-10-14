import { describe, expect, it } from 'vitest';
import { denominationKey, productRegionMatches, supportedRscRegion } from '../src/providers/catalog-matching.js';

describe('exact top-up catalogue matching', () => {
  it('matches the large MLBB delivered quantity including its verified bonus breakdown', () => {
    expect(denominationKey('9288 (7740+1548) Diamonds', 'mobile-legends'))
      .toBe(denominationKey('7740+1548', 'mobile-legends'));
    expect(denominationKey('9288 (7740+1500) Diamonds', 'mobile-legends')).toBeNull();
  });
  it('matches discounted PUBG quantities while excluding WOW Coins and bundled passes', () => {
    expect(denominationKey('8100 UC (discounted)', 'pubg-mobile')).toBe(denominationKey('8100 UC', 'pubg-mobile'));
    expect(denominationKey('8100 WOW Coins', 'pubg-mobile')).toBeNull();
    expect(denominationKey('Weekly Pass x3', 'mobile-legends')).toBeNull();
    expect(denominationKey('Weekly Diamond Pass', 'mobile-legends')).toBe('weekly-pass');
  });
  it('accepts only supported game/region channels and excludes cheaper manual suppliers', () => {
    expect(supportedRscRegion('pubg-mobile', 'pubg_mobile_auto', 'PUBG Mobile (Auto)')).toBe('GLOBAL');
    expect(supportedRscRegion('mobile-legends', 'mobile_legends_global', 'Mobile Legends Global')).toBe('GLOBAL');
    expect(supportedRscRegion('free-fire', 'free_fire_cis', 'Free Fire (CIS)')).toBe('CIS');
    expect(supportedRscRegion('pubg-mobile', 'pubg_mobile_manual', 'PUBG Mobile')).toBeNull();
    expect(supportedRscRegion('mobile-legends', 'mobile_legends_global', 'Mobile Legends Indonesia')).toBeNull();
  });
  it('does not equate a cheap region with the selected region', () => {
    expect(productRegionMatches('mobile-legends', 'GLOBAL', { code: 'BRAZIL' })).toBe(false);
    expect(productRegionMatches('pubg-mobile', 'GLOBAL', null)).toBe(true);
    expect(productRegionMatches('free-fire', 'CIS', null)).toBe(true);
  });
});
