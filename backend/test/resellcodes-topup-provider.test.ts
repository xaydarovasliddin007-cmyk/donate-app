import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReSellCodesTopupProvider } from '../src/providers/resellcodes/resellcodes-topup-provider.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('ReSellCodesTopupProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads account catalog and converts decimal USD prices into UZS tiyin exactly', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ data: [{ category_id: 'mlbb', name: 'Mobile Legends' }] }))
      .mockResolvedValueOnce(json({
        name: 'Mobile Legends Global',
        offers: [{ offer_id: 'weekly_pass', name: 'Weekly Pass', price_usd: '1.4500' }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ReSellCodesTopupProvider('test-key', 13_000);
    await expect(provider.listOffers('Legends')).resolves.toEqual([{
      categoryId: 'mlbb', categoryName: 'Mobile Legends Global', offerId: 'weekly_pass',
      name: 'Weekly Pass', priceUsd: '1.4500', costUzsMinor: 1_885_000,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/top-ups/categories?q=Legends');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it('submits one mapped player top-up with an idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ number: 42, status: 'processing' }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ReSellCodesTopupProvider('test-key', 13_000);

    const result = await provider.createTopup({
      providerProductCode: 'pubg_mobile_auto:60_uc', playerId: '5123456789', referenceId: 'order-42',
    });
    expect(result).toMatchObject({ success: true, status: 'PENDING', providerTransactionId: '42' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      category_id: 'pubg_mobile_auto', offer_id: '60_uc', fields: { player_id: '5123456789' },
    });
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('order-42');
  });

  it('exposes account-specific required fields for safe admin SKU matching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({
      fields: [{ key: 'player_id', label: 'Player ID' }, { key: 'server_id', label: 'Zone ID' }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ReSellCodesTopupProvider('test-key', 13_000);
    await expect(provider.getCategoryFields('mobile_legends_global')).resolves.toEqual([
      { key: 'player_id', label: 'Player ID' }, { key: 'server_id', label: 'Zone ID' },
    ]);
  });

  it('does not fallback on ambiguous server or transport failures', async () => {
    const serverFailure = vi.fn().mockResolvedValue(json({ message: 'try again' }, 500));
    vi.stubGlobal('fetch', serverFailure);
    const provider = new ReSellCodesTopupProvider('test-key', 13_000);
    const result = await provider.createTopup({
      providerProductCode: 'pubg_mobile_auto:60_uc', playerId: '5123456789', referenceId: 'order-43',
    });
    expect(result).toMatchObject({ success: false });
    expect(result.canFallback).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('keeps supplier refunds pending for audited admin reconciliation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ number: 44, status: 'refund', fail_code: 'supplier_failed' }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ReSellCodesTopupProvider('test-key', 13_000);
    await expect(provider.getTopupStatus('44')).resolves.toMatchObject({ status: 'PENDING' });
  });
});
