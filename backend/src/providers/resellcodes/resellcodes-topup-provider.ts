import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://resell.codes/api/v1';

interface RscOrder {
  number?: number;
  status?: string;
  status_reason?: string | null;
  fail_code?: string | null;
  error?: { message?: string; type?: string } | string;
}

interface RscCategoryList {
  data?: Array<{ category_id?: string; name?: string }>;
}

interface RscOffers {
  category_id?: string;
  name?: string;
  note?: string | null;
  fields?: Array<{ key: string; label?: string }>;
  offers?: Array<{ offer_id: string; name?: string; price_usd: string }>;
}

export interface ReSellCodesOffer {
  categoryId: string;
  categoryName: string;
  offerId: string;
  name: string;
  priceUsd: string;
  costUzsMinor: number;
}

export interface ReSellCodesCategoryField {
  key: string;
  label?: string;
  type?: string;
}

/**
 * ReSellCodes API v1 adapter. Product codes are
 * `<category_id>:<offer_id>[:<player_field>[:<server_field>]]`.
 * Catalogue methods are read-only; createTopup is only invoked by the paid
 * order fulfillment path. A transport/ambiguous error is never fallback-safe.
 */
export class ReSellCodesTopupProvider implements TopupProviderAdapter {
  readonly code = 'RESELLCODES';

  constructor(
    private readonly apiKey: string,
    private readonly usdUzsRate: number,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<{ response: Response; data: T | null }> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { response, data };
  }

  private splitCode(code: string) {
    const [categoryId, offerId, playerField = 'player_id', serverField = 'server_id'] = code.split(':');
    if (!categoryId || !offerId) throw new Error('Invalid ReSellCodes product mapping');
    return { categoryId, offerId, playerField, serverField };
  }

  private toMinor(priceUsd: string): number {
    if (!/^\d+(?:\.\d{1,4})?$/.test(priceUsd)) throw new Error('Invalid USD amount from ReSellCodes');
    const [whole = '0', fraction = ''] = priceUsd.split('.');
    const usdTenThousandths = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
    const uzsMinor = (usdTenThousandths * BigInt(this.usdUzsRate)) / 100n;
    if (uzsMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ReSellCodes price is out of range');
    return Number(uzsMinor);
  }

  async listOffers(query = ''): Promise<ReSellCodesOffer[]> {
    const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const { response, data } = await this.request<RscCategoryList>(`/top-ups/categories${q}`);
    if (!response.ok || !data?.data) throw new Error(`ReSellCodes catalogue returned HTTP ${response.status}`);

    const matches = data.data.filter((category) => category.category_id);
    const groups = await Promise.all(matches.map(async (category) => {
      const categoryId = category.category_id!;
      const result = await this.request<RscOffers>(`/top-ups/categories/${encodeURIComponent(categoryId)}/offers`);
      if (!result.response.ok || !result.data?.offers) return [];
      return result.data.offers.map((offer) => ({
        categoryId,
        categoryName: result.data?.name ?? category.name ?? categoryId,
        offerId: offer.offer_id,
        name: offer.name ?? offer.offer_id,
        priceUsd: offer.price_usd,
        costUzsMinor: this.toMinor(offer.price_usd),
      }));
    }));
    return groups.flat();
  }

  async getCategoryFields(categoryId: string): Promise<ReSellCodesCategoryField[]> {
    const { response, data } = await this.request<RscOffers>(`/top-ups/categories/${encodeURIComponent(categoryId)}/offers`);
    if (!response.ok || !data?.fields) throw new Error(`ReSellCodes category schema returned HTTP ${response.status}`);
    return data.fields;
  }

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    const { playerField, serverField } = this.splitCode(params.providerProductCode);
    if (!params.playerId.trim()) return { valid: false, reason: 'Player ID is required' };
    if (playerField !== 'player_id' && playerField !== 'user_id') {
      return { valid: false, reason: `Unsupported required account field: ${playerField}` };
    }
    if (serverField !== 'server_id' && params.serverId && !params.serverId.trim()) {
      return { valid: false, reason: 'Server ID is required' };
    }
    return { valid: true };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const { categoryId, offerId, playerField, serverField } = this.splitCode(params.providerProductCode);
    if (!params.playerId.trim()) {
      return { success: false, reason: 'Player ID is required', canFallback: true, status: 'FAILED' };
    }
    const fields: Record<string, string> = { [playerField]: params.playerId.trim() };
    if (params.serverId) fields[serverField] = params.serverId.trim();

    let response: Response;
    let raw: RscOrder | null;
    try {
      ({ response, data: raw } = await this.request<RscOrder>('/top-ups/order', {
        method: 'POST',
        headers: { 'Idempotency-Key': params.referenceId },
        body: JSON.stringify({ category_id: categoryId, offer_id: offerId, fields }),
      }));
    } catch {
      return { success: false, reason: 'ReSellCodes order result is unknown; reconciliation required' };
    }

    if (!response.ok || !raw) {
      const definitive = response.status >= 400 && response.status < 500 && response.status !== 429;
      const error = typeof raw?.error === 'string' ? raw.error : raw?.error?.message;
      return {
        success: false,
        reason: error ?? `ReSellCodes responded HTTP ${response.status}`,
        ...(definitive ? { status: 'FAILED' as const, canFallback: true } : {}),
        raw,
      };
    }

    const status = this.mapStatus(raw.status);
    if (status === 'FAILED') {
      return {
        success: false,
        status,
        providerTransactionId: raw.number == null ? undefined : String(raw.number),
        reason: raw.status_reason ?? 'ReSellCodes rejected the order',
        canFallback: true,
        raw,
      };
    }
    if (raw.number == null) {
      return { success: false, reason: 'ReSellCodes response has no order number; reconciliation required', raw };
    }
    return {
      success: true,
      status,
      providerTransactionId: String(raw.number),
      raw,
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const { response, data } = await this.request<RscOrder>(`/orders/${encodeURIComponent(providerTransactionId)}`);
    if (!response.ok || !data) return { status: 'PENDING' };
    if (data.status?.toLowerCase() === 'refund') return { status: 'PENDING', raw: data };
    return { status: this.mapStatus(data.status), raw: data };
  }

  private mapStatus(status?: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'SUCCESS';
      case 'failed':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }
}
