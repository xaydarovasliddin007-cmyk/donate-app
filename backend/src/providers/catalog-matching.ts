/** Match only a single denomination, never bundles, passes with multipliers or other currencies. */
export function denominationKey(name: string, gameSlug: string): string | null {
  const cleaned = name.trim().replace(/\s*\(discounted\)\s*$/i, '').replace(/\bdiamonds?\b|\buc\b/gi, '').trim();
  if (gameSlug === 'mobile-legends' && /^(?:weekly(?:\s+diamond)?\s+pass|weekly)$/i.test(cleaned)) return 'weekly-pass';
  const totalWithBreakdown = cleaned.match(/^(\d+)\s*\(\s*(\d+)\s*\+\s*(\d+)\s*\)$/);
  if (totalWithBreakdown) {
    const total = Number(totalWithBreakdown[1]);
    return total === Number(totalWithBreakdown[2]) + Number(totalWithBreakdown[3]) ? `quantity:${total}` : null;
  }
  if (/^\d+(?:\s*\+\s*\d+)?$/.test(cleaned)) {
    const total = cleaned.split('+').reduce((sum, part) => sum + Number(part.trim()), 0);
    return Number.isSafeInteger(total) && total > 0 ? `quantity:${total}` : null;
  }
  return null;
}

/** Explicit channels only: PUBG Auto, MLBB Global, FF CIS. Manual routes are excluded. */
export function supportedRscRegion(gameSlug: string, categoryId: string, categoryName: string): string | null {
  const code = categoryId.toLowerCase();
  const title = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/manual/i.test(`${code} ${title}`)) return null;
  if (gameSlug === 'pubg-mobile' && code === 'pubg_mobile_auto' && /^pubg mobile(?: auto)?(?: global)?$/.test(title)) return 'GLOBAL';
  if (gameSlug === 'mobile-legends' && code === 'mobile_legends_global' && /^mobile legends(?: bang bang)?(?: global)?$/.test(title)) return 'GLOBAL';
  if (gameSlug === 'free-fire' && code === 'free_fire_cis' && /^free fire(?: cis)?$/.test(title)) return 'CIS';
  return null;
}

export function productRegionMatches(gameSlug: string, region: string, server: { code: string } | null): boolean {
  // The unsegmented Free Fire catalogue serves Uzbekistan/CIS; other unsegmented
  // catalogues use Global. An explicitly selected region must match exactly.
  return (server?.code ?? (gameSlug === 'free-fire' ? 'CIS' : 'GLOBAL')).toUpperCase() === region;
}
