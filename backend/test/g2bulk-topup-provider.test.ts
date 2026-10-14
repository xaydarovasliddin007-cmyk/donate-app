import { afterEach, describe, expect, it, vi } from 'vitest';
import { G2BulkTopupProvider } from '../src/providers/g2bulk/g2bulk-topup-provider.js';
import { usdToUzsMinor } from '../src/providers/usd-cost.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const referenceId = '550e8400-e29b-41d4-a716-446655440000';
const params = { providerProductCode: 'pubgm:8100%20UC%20(discounted)', playerId: '5123456789',
  referenceId, expectedCostMinor: 110_500_000 };
const fields = { code: '200', info: { fields: ['userid'] } };
const catalogue = { success: true, game: { code: 'pubgm' }, catalogues: [
  { name: '8100 UC (discounted)', amount: 85 }, { name: '8100', amount: 90.5 },
  { name: '8100 WOW Coins', amount: 80 }, { name: 'Prime (1 Month)', amount: .88 },
] };
function preflight(orderResponse: Response | Error, balance = 100) {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(fields)).mockResolvedValueOnce(json(catalogue))
    .mockResolvedValueOnce(json({ success: true, balance }));
  if (orderResponse instanceof Error) fetchMock.mockRejectedValueOnce(orderResponse);
  else fetchMock.mockResolvedValueOnce(orderResponse);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('G2Bulk direct PUBG adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads public live UC quotes without exposing the secret or including unrelated currencies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(catalogue));
    vi.stubGlobal('fetch', fetchMock);
    const offers = await new G2BulkTopupProvider('secret', 13_000).listOffers();
    expect(offers.map((offer) => offer.costUzsMinor)).toEqual([110_500_000, 117_650_000]);
    expect(offers[0]?.providerProductCode).toBe(params.providerProductCode);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('X-API-Key')).toBe(false);
  });

  it('validates the player using the documented public player endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(fields)).mockResolvedValueOnce(json({ valid: 'valid', name: 'PUBG Player' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new G2BulkTopupProvider('secret', 13_000).validatePlayer(params))
      .resolves.toEqual({ valid: true, playerName: 'PUBG Player' });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ game: 'pubgm', user_id: params.playerId });
  });

  it('submits only the exact live denomination with a UUID idempotency header and keeps acceptance pending', async () => {
    const fetchMock = preflight(json({ success: true, order: { order_id: 42, status: 'PENDING' } }));
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup(params))
      .resolves.toMatchObject({ success: true, status: 'PENDING', providerTransactionId: '42', costMinor: 110_500_000 });
    const [url, init] = fetchMock.mock.calls[3]!;
    expect(url).toBe('https://api.g2bulk.com/v1/games/pubgm/order');
    expect(new Headers(init.headers).get('X-Idempotency-Key')).toBe(referenceId);
    expect(new Headers(init.headers).get('X-API-Key')).toBe('secret');
    expect(JSON.parse(init.body)).toEqual({ catalogue_name: '8100 UC (discounted)', player_id: params.playerId, remark: referenceId });
  });

  it('rejects a price increase before placing any purchase', async () => {
    const fetchMock = preflight(json({ success: true, order: { order_id: 42 } }));
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup({ ...params, expectedCostMinor: 100_000_000 }))
      .resolves.toMatchObject({ status: 'FAILED', canFallback: true, reason: expect.stringContaining('price increased') });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('routes elsewhere before purchase when wallet funds are insufficient', async () => {
    const fetchMock = preflight(json({ success: true }), 0);
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup(params))
      .resolves.toMatchObject({ status: 'FAILED', canFallback: true, reason: expect.stringContaining('balance') });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    { ...params, referenceId: 'not-a-uuid' }, { ...params, expectedCostMinor: undefined },
    { ...params, gameServerCode: 'KOREA' }, { ...params, providerProductCode: 'mlbb:8100' },
  ])('rejects an unsafe mapping/configuration before calling the supplier: %j', async (invalid) => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup(invalid))
      .resolves.toMatchObject({ status: 'FAILED', canFallback: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses new account field requirements before buying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ code: '200', info: { fields: ['userid', 'charname'] } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup(params))
      .resolves.toMatchObject({ status: 'FAILED', canFallback: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([new Error('timeout'), json({ success: false }, 500), json({ success: false }, 409),
    json({ success: false }, 429), json({ success: true, order: { status: 'COMPLETED' } })])
  ('never falls back after an uncertain purchase result', async (response) => {
    preflight(response);
    const result = await new G2BulkTopupProvider('secret', 13_000).createTopup(params);
    expect(result.status).toBe('PENDING');
    expect(result.canFallback).not.toBe(true);
  });

  it('allows fallback on a documented pre-acceptance bad request', async () => {
    preflight(json({ success: false, message: 'Invalid player' }, 400));
    await expect(new G2BulkTopupProvider('secret', 13_000).createTopup(params))
      .resolves.toMatchObject({ status: 'FAILED', canFallback: true });
  });

  it('does not purchase elsewhere after an accepted order reports failure', async () => {
    preflight(json({ success: true, order: { order_id: 42, status: 'FAILED' } }));
    const result = await new G2BulkTopupProvider('secret', 13_000).createTopup(params);
    expect(result.status).toBe('FAILED');
    expect(result.canFallback).not.toBe(true);
  });

  it('stops authenticated requests after a rejected key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: false }, 401)); vi.stubGlobal('fetch', fetchMock);
    const provider = new G2BulkTopupProvider('bad-key', 13_000);
    await expect(provider.verifyAccount()).rejects.toThrow();
    await expect(provider.verifyAccount()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reconciles a matching player/game order from paginated authenticated history', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ success: true, orders: [], pagination: { total_pages: 2 } }))
      .mockResolvedValueOnce(json({ success: true, orders: [{ order_id: 42, game_code: 'pubgm', player_id: params.playerId, status: 'completed' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new G2BulkTopupProvider('secret', 13_000).getTopupStatus('42', params)).resolves.toMatchObject({ status: 'SUCCESS' });
    expect(fetchMock.mock.calls[1]?.[0]).toContain('page=2&limit=100');
  });

  it.each([{ status: 'partial' }, { status: 'completed', player_id: 'wrong-player' }, { status: 'completed', game_code: 'mlbb' }])
  ('leaves an unfamiliar or mismatching history entry pending', async (override) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, orders: [
      { order_id: 42, game_code: 'pubgm', player_id: params.playerId, ...override },
    ] })));
    await expect(new G2BulkTopupProvider('secret', 13_000).getTopupStatus('42', params)).resolves.toMatchObject({ status: 'PENDING' });
  });
});

describe('supplier currency conversion', () => {
  it('preserves decimal quotes and rounds fractions of a tiyin up', () => {
    expect(usdToUzsMinor('1.4500', 13_000)).toBe(1_885_000);
    expect(usdToUzsMinor('0.000001', 12_345)).toBe(2);
  });
  it.each(['-1', 'NaN', '1e4', '2000000', '0'])('rejects invalid/free or out-of-range quotes: %s', (price) => {
    expect(() => usdToUzsMinor(price, 13_000)).toThrow();
  });
});
