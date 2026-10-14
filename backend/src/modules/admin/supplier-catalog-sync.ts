import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { ConflictError } from '../../lib/errors.js';
import { writeAuditLog } from '../../lib/audit.js';
import { G2BulkTopupProvider } from '../../providers/g2bulk/g2bulk-topup-provider.js';
import { ReSellCodesTopupProvider } from '../../providers/resellcodes/resellcodes-topup-provider.js';
import { denominationKey, productRegionMatches, supportedRscRegion } from '../../providers/catalog-matching.js';

interface SelectedMapping { productId: string; providerProductCode: string; costMinor: number }

async function storeMappings(prisma: PrismaClient, actorId: string, code: string, name: string,
  selected: Map<string, SelectedMapping>, offerCount: number, unmatched: number, usdUzsRate: number) {
  const now = new Date();
  const result = { success: true, mapped: selected.size, unmatched, offerCount, usdUzsRate };
  await prisma.$transaction(async (tx) => {
    const supplier = await tx.provider.upsert({
      where: { code }, update: { name, type: 'TOPUP', lastCheckedAt: now },
      create: { code, name, type: 'TOPUP', isActive: false, healthStatus: 'UNKNOWN', lastCheckedAt: now },
    });
    const existing = await tx.providerProduct.findMany({ where: { providerId: supplier.id } });
    for (const mapping of selected.values()) {
      const previous = existing.find((item) => item.productId === mapping.productId);
      await tx.providerProduct.upsert({
        where: { providerId_productId: { providerId: supplier.id, productId: mapping.productId } },
        update: { providerProductCode: mapping.providerProductCode, costMinor: mapping.costMinor, priceUpdatedAt: now,
          // Preserve reviewed routes on price refresh; a different SKU needs review.
          ...(previous?.providerProductCode !== mapping.providerProductCode ? { isActive: false } : {}) },
        create: { ...mapping, providerId: supplier.id, priceUpdatedAt: now, isActive: false, priority: 0 },
      });
    }
    // Never keep a disappeared or unsupported SKU eligible for new orders.
    await tx.providerProduct.updateMany({
      where: { providerId: supplier.id, productId: { notIn: [...selected.keys()] } }, data: { isActive: false },
    });
    await writeAuditLog(tx, { actorId, action: `provider.${code.toLowerCase()}.catalog_sync`,
      entityType: 'Provider', entityId: supplier.id, metadata: result });
  });
  return result;
}

function keepCheapest(selected: Map<string, SelectedMapping>, mapping: SelectedMapping) {
  const previous = selected.get(mapping.productId);
  if (!previous || mapping.costMinor < previous.costMinor ||
    (mapping.costMinor === previous.costMinor && mapping.providerProductCode < previous.providerProductCode)) {
    selected.set(mapping.productId, mapping);
  }
}

export async function syncG2BulkPrices(prisma: PrismaClient, actorId: string) {
  if (!env.G2BULK_USD_UZS_RATE) throw new ConflictError('Set G2BULK_USD_UZS_RATE to your effective UZS/USD funding rate');
  const adapter = new G2BulkTopupProvider(env.G2BULK_API_KEY ?? '', env.G2BULK_USD_UZS_RATE);
  // Catalogues are public; a configured key is checked once without placing an order.
  if (env.G2BULK_API_KEY) await adapter.verifyAccount();
  await adapter.assertSupportedFields();
  const offers = await adapter.listOffers();
  const products = await prisma.product.findMany({
    where: { isActive: true, currency: 'UZS', game: { slug: 'pubg-mobile' } }, include: { server: true },
  });
  const selected = new Map<string, SelectedMapping>();
  let unmatched = 0;
  for (const offer of offers) {
    const key = denominationKey(offer.name, 'pubg-mobile');
    const matches = products.filter((product) => key && denominationKey(product.name, 'pubg-mobile') === key &&
      productRegionMatches('pubg-mobile', 'GLOBAL', product.server));
    if (matches.length !== 1) { unmatched++; continue; }
    keepCheapest(selected, { productId: matches[0]!.id, providerProductCode: offer.providerProductCode, costMinor: offer.costUzsMinor });
  }
  return storeMappings(prisma, actorId, 'G2BULK', 'G2Bulk', selected, offers.length, unmatched, env.G2BULK_USD_UZS_RATE);
}

export async function syncReSellCodesPrices(prisma: PrismaClient, actorId: string) {
  if (!env.RSC_API_KEY) throw new ConflictError('ReSellCodes API key is not configured on the server');
  if (!env.RSC_USD_UZS_RATE) throw new ConflictError('Set the effective UZS/USD funding rate before syncing ReSellCodes prices');
  const adapter = new ReSellCodesTopupProvider(env.RSC_API_KEY, env.RSC_USD_UZS_RATE);
  const offers = (await Promise.all(['Mobile Legends', 'PUBG Mobile', 'Free Fire'].map((query) => adapter.listOffers(query)))).flat();
  const games = await prisma.game.findMany({
    where: { slug: { in: ['mobile-legends', 'pubg-mobile', 'free-fire'] } },
    include: { products: { where: { isActive: true, currency: 'UZS' }, include: { server: true } } },
  });
  const selected = new Map<string, SelectedMapping>();
  const fields = new Map<string, Awaited<ReturnType<ReSellCodesTopupProvider['getCategoryFields']>>>();
  let unmatched = 0;
  for (const offer of offers) {
    const game = games.find((item) => supportedRscRegion(item.slug, offer.categoryId, offer.categoryName));
    const region = game && supportedRscRegion(game.slug, offer.categoryId, offer.categoryName);
    if (!game || !region) { unmatched++; continue; }
    if (!fields.has(offer.categoryId)) fields.set(offer.categoryId, await adapter.getCategoryFields(offer.categoryId));
    const schema = fields.get(offer.categoryId)!;
    const playerField = schema.find((field) => ['player_id', 'user_id'].includes(field.key))?.key;
    const serverField = schema.find((field) => ['server_id', 'zone_id'].includes(field.key))?.key;
    if (!playerField || schema.some((field) => (field.type && field.type !== 'text') ||
      (field.key !== playerField && field.key !== serverField))) { unmatched++; continue; }
    const key = denominationKey(offer.name, game.slug);
    const matches = game.products.filter((product) => key && denominationKey(product.name, game.slug) === key &&
      productRegionMatches(game.slug, region, product.server));
    if (matches.length !== 1) { unmatched++; continue; }
    keepCheapest(selected, { productId: matches[0]!.id,
      providerProductCode: `${offer.categoryId}:${offer.offerId}:${playerField}:${serverField ?? ''}`, costMinor: offer.costUzsMinor });
  }
  return storeMappings(prisma, actorId, 'RESELLCODES', 'ReSellCodes', selected, offers.length, unmatched, env.RSC_USD_UZS_RATE);
}
