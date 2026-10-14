import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { G2BulkTopupProvider } from '../src/providers/g2bulk/g2bulk-topup-provider.js';
import { ReSellCodesTopupProvider } from '../src/providers/resellcodes/resellcodes-topup-provider.js';
import { syncG2BulkPrices, syncReSellCodesPrices } from '../src/modules/admin/supplier-catalog-sync.js';

const prisma = new PrismaClient();
const saved = { g2Key: env.G2BULK_API_KEY, g2Rate: env.G2BULK_USD_UZS_RATE, rscKey: env.RSC_API_KEY, rscRate: env.RSC_USD_UZS_RATE };
const offer = (name: string, costMinor: number) => ({ name, priceUsd: costMinor / 1_300_000,
  costUzsMinor: costMinor, providerProductCode: `pubgm:${encodeURIComponent(name)}` });

describe('supplier cost synchronization (isolated DB)', () => {
  let g2Id: string;
  let rscId: string;
  let pubgId: string;
  let actorId: string;
  beforeAll(async () => {
    const g2 = await prisma.provider.findUniqueOrThrow({ where: { code: 'G2BULK' } });
    const rsc = await prisma.provider.findUniqueOrThrow({ where: { code: 'RESELLCODES' } });
    g2Id = g2.id; rscId = rsc.id;
    actorId = (await prisma.adminUser.findFirstOrThrow()).id;
    pubgId = (await prisma.product.findFirstOrThrow({ where: { name: '8100 UC', game: { slug: 'pubg-mobile' } } })).id;
    env.G2BULK_API_KEY = 'isolated-g2-key'; env.G2BULK_USD_UZS_RATE = 13_000;
    env.RSC_API_KEY = 'isolated-rsc-key'; env.RSC_USD_UZS_RATE = 13_000;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    env.G2BULK_API_KEY = saved.g2Key; env.G2BULK_USD_UZS_RATE = saved.g2Rate;
    env.RSC_API_KEY = saved.rscKey; env.RSC_USD_UZS_RATE = saved.rscRate;
    await prisma.providerProduct.deleteMany({ where: { providerId: { in: [g2Id, rscId] } } });
    await prisma.provider.updateMany({ where: { id: { in: [g2Id, rscId] } }, data: { isActive: false } });
    await prisma.$disconnect();
  });
  function mockG2(offers = [offer('8100', 117_650_000), offer('8100 UC (discounted)', 110_500_000)]) {
    vi.spyOn(G2BulkTopupProvider.prototype, 'verifyAccount').mockResolvedValue(100);
    vi.spyOn(G2BulkTopupProvider.prototype, 'assertSupportedFields').mockResolvedValue();
    vi.spyOn(G2BulkTopupProvider.prototype, 'listOffers').mockResolvedValue(offers);
  }

  it('stores only the cheapest exact G2Bulk denomination, with new routes disabled', async () => {
    mockG2();
    const result = await syncG2BulkPrices(prisma, actorId);
    expect(result.mapped).toBe(1);
    const mapping = await prisma.providerProduct.findUniqueOrThrow({ where: { providerId_productId: { providerId: g2Id, productId: pubgId } } });
    expect(mapping).toMatchObject({ costMinor: 110_500_000, providerProductCode: offer('8100 UC (discounted)', 1).providerProductCode, isActive: false });
    expect(mapping.priceUpdatedAt).not.toBeNull();
    expect((await prisma.provider.findUniqueOrThrow({ where: { id: g2Id } })).isActive).toBe(false);
  });

  it('refreshes a reviewed price without deactivating the supplier or mapping', async () => {
    await prisma.provider.update({ where: { id: g2Id }, data: { isActive: true } });
    await prisma.providerProduct.updateMany({ where: { providerId: g2Id }, data: { isActive: true } });
    mockG2([offer('8100 UC (discounted)', 109_200_000)]);
    await syncG2BulkPrices(prisma, actorId);
    expect((await prisma.provider.findUniqueOrThrow({ where: { id: g2Id } })).isActive).toBe(true);
    expect(await prisma.providerProduct.findUniqueOrThrow({ where: { providerId_productId: { providerId: g2Id, productId: pubgId } } }))
      .toMatchObject({ isActive: true, costMinor: 109_200_000 });
  });

  it('disables a changed SKU and then disables a disappeared denomination', async () => {
    mockG2([offer('8100', 105_000_000)]);
    await syncG2BulkPrices(prisma, actorId);
    expect((await prisma.providerProduct.findUniqueOrThrow({ where: { providerId_productId: { providerId: g2Id, productId: pubgId } } })).isActive).toBe(false);
    await prisma.providerProduct.updateMany({ where: { providerId: g2Id }, data: { isActive: true } });
    vi.mocked(G2BulkTopupProvider.prototype.listOffers).mockResolvedValue([]);
    await syncG2BulkPrices(prisma, actorId);
    expect((await prisma.providerProduct.findUniqueOrThrow({ where: { providerId_productId: { providerId: g2Id, productId: pubgId } } })).isActive).toBe(false);
  });

  it('leaves reviewed routes untouched when the live catalogue request fails', async () => {
    await prisma.providerProduct.updateMany({ where: { providerId: g2Id }, data: { isActive: true } });
    mockG2();
    vi.mocked(G2BulkTopupProvider.prototype.listOffers).mockRejectedValue(new Error('Supplier unavailable'));
    await expect(syncG2BulkPrices(prisma, actorId)).rejects.toThrow('Supplier unavailable');
    expect((await prisma.providerProduct.findUniqueOrThrow({ where: { providerId_productId: { providerId: g2Id, productId: pubgId } } })).isActive).toBe(true);
  });

  it('matches large MLBB Global bonuses and PUBG Auto while excluding the cheaper manual channel', async () => {
    const rscOffer = (categoryId: string, categoryName: string, name: string, costUzsMinor: number) => ({
      categoryId, categoryName, name, costUzsMinor, priceUsd: '85', offerId: name,
    });
    vi.spyOn(ReSellCodesTopupProvider.prototype, 'listOffers').mockImplementation(async (query) => query === 'Mobile Legends' ? [
      rscOffer('mobile_legends_global', 'Mobile Legends Global', '7740+1548', 145_000_000),
    ] : query === 'PUBG Mobile' ? [
      rscOffer('pubg_mobile_auto', 'PUBG Mobile (Auto)', '8100 UC', 112_970_000),
      rscOffer('pubg_mobile_manual', 'PUBG Mobile', '8100 UC', 106_990_000),
    ] : [rscOffer('free_fire_cis', 'Free Fire (CIS)', '6160 Diamonds', 50_700_000)]);
    vi.spyOn(ReSellCodesTopupProvider.prototype, 'getCategoryFields').mockImplementation(async (category) => category.startsWith('mobile_legends')
      ? [{ key: 'user_id' }, { key: 'zone_id' }] : [{ key: 'player_id' }]);
    const result = await syncReSellCodesPrices(prisma, actorId);
    expect(result).toMatchObject({ mapped: 3, unmatched: 1 });
    const mappings = await prisma.providerProduct.findMany({ where: { providerId: rscId }, include: { product: { include: { server: true } } } });
    expect(mappings.find((mapping) => mapping.product.name.startsWith('9288'))?.product.server?.code).toBe('GLOBAL');
    expect(mappings.find((mapping) => mapping.productId === pubgId)?.costMinor).toBe(112_970_000);
    expect(mappings.every((mapping) => !mapping.providerProductCode.includes('manual'))).toBe(true);
    expect(mappings.find((mapping) => mapping.product.name.startsWith('6160'))).toBeDefined();
  });
});
