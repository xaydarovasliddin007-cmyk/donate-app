import { afterEach, describe, expect, it, vi } from 'vitest';
import { FazerCardsTopupProvider } from '../src/providers/fazercards/fazercards-topup-provider.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const validationGames = (fields = [
  { key: 'player_id', label: 'Player ID' },
  { key: 'zone_id', label: 'Zone ID' },
]) => ({
  ok: true,
  items: [{ category_id: 'mobile_legends', name: 'Mobile Legends', fields }],
});

describe('FazerCardsTopupProvider player validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the validation category and fields separately, then returns the MLBB nickname', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(validationGames()))
      .mockResolvedValueOnce(json({
        ok: true,
        category_id: 'mobile_legends',
        valid: true,
        player_name: 'Asliddin',
        region: 'Global',
      }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await expect(provider.validatePlayer({
      providerProductCode: 'mobile_legends_global:weekly_pass:player_id:zone_id',
      playerId: '123456789',
      serverId: '16529',
    })).resolves.toEqual({ valid: true, playerName: 'Asliddin', playerRegion: 'Global' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.fzr.cards/api/v2/topups/validate-id');
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get('X-API-Key')).toBe('test-key');
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      category_id: 'mobile_legends',
      fields: { player_id: '123456789', zone_id: '16529' },
    });
  });

  it('uses the MLBB Zone field when a saved provider mapping omits field overrides', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true, order: { id: 'ord-1', status: 'processing' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await provider.createTopup({
      providerProductCode: 'mobile_legends_global:weekly_pass',
      playerId: '123456789',
      serverId: '16529',
      referenceId: 'order-1',
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      category_id: 'mobile_legends_global',
      offer_id: 'weekly_pass',
      fields: { player_id: '123456789', zone_id: '16529' },
    });
  });

  it('rejects invalid MLBB identity and does not claim an ID-only match', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(validationGames()))
      .mockResolvedValueOnce(json({ ok: true, valid: false, error: 'Zone ID does not match' }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await expect(provider.validatePlayer({
      providerProductCode: 'mobile_legends_global:weekly_pass',
      playerId: '123456789',
      serverId: 'wrong-zone',
    })).resolves.toEqual({ valid: false, reason: 'Zone ID does not match' });
  });

  it('fails closed when the provider validates an account but omits its nickname', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(validationGames()))
      .mockResolvedValueOnce(json({ ok: true, valid: true }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await expect(provider.validatePlayer({
      providerProductCode: 'mobile_legends_global:weekly_pass',
      playerId: '123456789',
      serverId: '16529',
    })).resolves.toMatchObject({ valid: false, reason: expect.stringContaining('did not return a nickname') });
  });

  it('fails closed when FazerCards does not expose both MLBB identity fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(validationGames([{ key: 'player_id', label: 'Player ID' }])));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await expect(provider.validatePlayer({
      providerProductCode: 'mobile_legends_global:weekly_pass',
      playerId: '123456789',
      serverId: '16529',
    })).resolves.toMatchObject({ valid: false, reason: expect.stringContaining('does not expose MLBB') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the provider when the MLBB Zone ID is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FazerCardsTopupProvider('test-key');

    await expect(provider.validatePlayer({
      providerProductCode: 'mobile_legends_global:weekly_pass',
      playerId: '123456789',
    })).resolves.toMatchObject({ valid: false, reason: 'Zone ID is required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
