import type {
  CreateTopupParams, CreateTopupResult, TopupProviderAdapter, TopupStatus,
  TopupStatusResult, TopupValidatePlayerParams, TopupValidatePlayerResult,
} from '../topup-provider.js';
import { usdToUzsMinor } from '../usd-cost.js';

const BASE_URL = 'https://api.g2bulk.com/v1';
interface G2Order {
  order_id?: number | string;
  status?: string;
  price?: number | string;
  game_code?: string;
  player_id?: string;
}
interface G2Response {
  success?: boolean;
  message?: string;
  order?: G2Order;
  orders?: G2Order[];
  pagination?: { total_pages?: number };
}
export interface G2BulkOffer {
  name: string;
  priceUsd: number | string;
  costUzsMinor: number;
  providerProductCode: string;
}

/** Documented REST v1 direct PUBG top-ups. Codes: pubgm:<URL-encoded catalogue name>. */
export class G2BulkTopupProvider implements TopupProviderAdapter {
  readonly code = 'G2BULK';
  private authRejected = false;

  constructor(private readonly apiKey: string, private readonly usdUzsRate: number) {}

  private async request<T>(path: string, init?: RequestInit, authenticated = false) {
    if (authenticated && (!this.apiKey || this.authRejected)) throw new Error('G2Bulk API credentials require attention');
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(12_000),
      headers: {
        ...(authenticated ? { 'X-API-Key': this.apiKey } : {}),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    // G2Bulk warns repeated authentication failures can permanently ban the server IP.
    if (authenticated && response.status === 401) this.authRejected = true;
    return { response, data: await response.json().catch(() => null) as T | null };
  }

  private catalogueName(code: string): string {
    const [game, encoded, extra] = code.split(':');
    if (game !== 'pubgm' || !encoded || extra !== undefined) throw new Error('Invalid G2Bulk PUBG mapping');
    const name = decodeURIComponent(encoded);
    if (!/^\d+(?:\s+UC)?(?:\s*\(discounted\))?$/i.test(name)) throw new Error('Unsupported G2Bulk PUBG denomination');
    return name;
  }

  async assertSupportedFields(): Promise<void> {
    const { response, data } = await this.request<{ code?: string; info?: { fields?: string[] } }>('/games/fields', {
      method: 'POST', body: JSON.stringify({ game: 'pubgm' }),
    });
    if (!response.ok || String(data?.code) !== '200' || data?.info?.fields?.length !== 1 || data.info.fields[0] !== 'userid') {
      throw new Error('G2Bulk PUBG account requirements could not be confirmed');
    }
  }

  async listOffers(): Promise<G2BulkOffer[]> {
    const { response, data } = await this.request<{
      success?: boolean; game?: { code?: string };
      catalogues?: Array<{ name?: string; amount?: number | string }>;
    }>('/games/pubgm/catalogue');
    if (!response.ok || data?.success !== true || data.game?.code !== 'pubgm' || !Array.isArray(data.catalogues)) {
      throw new Error('G2Bulk PUBG catalogue could not be loaded');
    }
    return data.catalogues.flatMap((item) => {
      if (!item.name || item.amount == null || !/^\d+(?:\s+UC)?(?:\s*\(discounted\))?$/i.test(item.name)) return [];
      return [{ name: item.name, priceUsd: item.amount, costUzsMinor: usdToUzsMinor(item.amount, this.usdUzsRate),
        providerProductCode: `pubgm:${encodeURIComponent(item.name)}` }];
    });
  }

  async verifyAccount(): Promise<number> {
    const { response, data } = await this.request<{ success?: boolean; balance?: number }>('/getMe', undefined, true);
    if (!response.ok || data?.success !== true || !Number.isFinite(data.balance)) throw new Error('G2Bulk account could not be verified');
    return data.balance!;
  }

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    this.catalogueName(params.providerProductCode);
    if (!/^\d+$/.test(params.playerId.trim())) return { valid: false, reason: 'PUBG player ID must contain digits' };
    await this.assertSupportedFields();
    const { response, data } = await this.request<{ valid?: string; name?: string }>('/games/checkPlayerId', {
      method: 'POST', body: JSON.stringify({ game: 'pubgm', user_id: params.playerId.trim() }),
    });
    if (!response.ok || data?.valid !== 'valid') return { valid: false, reason: 'G2Bulk could not confirm this PUBG player' };
    return { valid: true, ...(data.name ? { playerName: data.name } : {}) };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    let quotedCost: number;
    let catalogueName: string;
    // All failures in this preflight are safe to route elsewhere: no purchase was submitted.
    try {
      catalogueName = this.catalogueName(params.providerProductCode);
      if (!/^\d+$/.test(params.playerId.trim())) throw new Error('PUBG player ID must contain digits');
      if (params.gameServerCode && params.gameServerCode !== 'GLOBAL') throw new Error('Unsupported PUBG pricing region');
      if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(params.referenceId)) throw new Error('G2Bulk requires a UUID order reference');
      if (params.expectedCostMinor == null) throw new Error('Sync G2Bulk cost before fulfilling this mapping');
      if (!this.apiKey || this.authRejected) throw new Error('G2Bulk API credentials require attention');
      await this.assertSupportedFields();
      const offer = (await this.listOffers()).find((item) => item.name === catalogueName);
      if (!offer) throw new Error('Mapped G2Bulk denomination is unavailable');
      quotedCost = offer.costUzsMinor;
      if (quotedCost > params.expectedCostMinor) throw new Error('G2Bulk price increased; refresh supplier costs');
      const balance = await this.verifyAccount();
      if (balance < Number(offer.priceUsd)) throw new Error('G2Bulk wallet balance is insufficient');
    } catch (error) {
      return { success: false, status: 'FAILED', canFallback: true, reason: error instanceof Error ? error.message : 'G2Bulk preflight failed' };
    }

    let response: Response;
    let data: G2Response | null;
    try {
      ({ response, data } = await this.request<G2Response>('/games/pubgm/order', {
        method: 'POST', headers: { 'X-Idempotency-Key': params.referenceId },
        body: JSON.stringify({ catalogue_name: catalogueName, player_id: params.playerId.trim(), remark: params.referenceId }),
      }, true));
    } catch {
      return { success: false, status: 'PENDING', reason: 'G2Bulk order result is unknown; reconciliation required' };
    }
    const order = data?.order;
    const rawId = String(order?.order_id ?? '');
    const id = /^[1-9]\d*$/.test(rawId) ? rawId : undefined;
    if (!response.ok || data?.success !== true || !id) {
      const rejected = !id && data?.success === false && [400, 401, 403, 404, 422].includes(response.status);
      return { success: false, status: rejected ? 'FAILED' : 'PENDING', ...(rejected ? { canFallback: true } : {}),
        ...(id ? { providerTransactionId: id } : {}), reason: data?.message ?? 'G2Bulk order requires reconciliation', raw: data };
    }
    const status = this.mapStatus(order?.status);
    // Supplier failure/refund after acceptance requires reconciliation, not another purchase.
    return { success: status !== 'FAILED', status, providerTransactionId: id, costMinor: quotedCost, raw: data };
  }

  async getTopupStatus(providerTransactionId: string, params?: CreateTopupParams): Promise<TopupStatusResult> {
    // The docs omit the POST /games/order/status request schema. Use documented game
    // history instead, bounded to ten pages; missing/unknown orders remain pending.
    for (let page = 1; page <= 10; page++) {
      const { response, data } = await this.request<G2Response>(`/games/orders?page=${page}&limit=100`, undefined, true);
      if (!response.ok || data?.success !== true || !Array.isArray(data.orders)) return { status: 'PENDING' };
      const order = data.orders.find((item) => String(item.order_id) === providerTransactionId);
      if (order) {
        if (order.game_code !== 'pubgm' || (params && String(order.player_id) !== params.playerId.trim())) return { status: 'PENDING', raw: order };
        return { status: this.mapStatus(order.status), raw: order };
      }
      if (!data.pagination?.total_pages || page >= data.pagination.total_pages) break;
    }
    return { status: 'PENDING' };
  }

  private mapStatus(status?: string): TopupStatus {
    if (status?.toUpperCase() === 'COMPLETED') return 'SUCCESS';
    if (status?.toUpperCase() === 'FAILED') return 'FAILED';
    return 'PENDING';
  }
}
