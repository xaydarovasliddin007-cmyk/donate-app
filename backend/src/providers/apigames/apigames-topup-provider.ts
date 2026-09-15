import { createHash } from 'node:crypto';
import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://v1.apigames.id';

/**
 * Apigames.id — a wholesale H2H (host-to-host) game top-up aggregator that
 * routes orders across several upstream suppliers (Smile.one, UniPin,
 * Kiosgamer, ...) for competitive pricing, rather than being a single
 * publisher-direct API. Chosen over UniPin Direct/Codashop Distribution for
 * the mobile-app + admin-panel-triggered order pipeline specifically
 * because its onboarding is self-service (no business-verification/BD-team
 * process) — see backend/README.md "Apigames top-up setup".
 *
 * IMPORTANT — placeholder request/response shape: their published API
 * reference (docs.apigames.id) is a JS-rendered Postman collection that
 * couldn't be fetched and read programmatically to confirm exact endpoint
 * paths, auth signature construction, and field names. The auth signature
 * below (md5(username + apiKey + ref_id)) and endpoint paths follow the
 * common convention this class of Indonesian H2H API uses (matching
 * Digiflazz-style providers), but must be verified against the real
 * member-area documentation once an account exists, before this ever
 * handles a real order — do not treat this as tested/confirmed-correct.
 */
export class ApiGamesTopupProvider implements TopupProviderAdapter {
  readonly code = 'APIGAMES';

  constructor(
    private readonly username: string,
    private readonly apiKey: string,
  ) {}

  private signature(refId: string): string {
    return createHash('md5').update(`${this.username}${this.apiKey}${refId}`).digest('hex');
  }

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    const refId = `validate-${Date.now()}`;
    const response = await fetch(`${BASE_URL}/cek-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: this.username,
        signature: this.signature(refId),
        ref_id: refId,
        kode_produk: params.providerProductCode,
        tujuan: params.serverId ? `${params.playerId}${params.serverId}` : params.playerId,
      }),
    });

    if (!response.ok) {
      return { valid: false, reason: `Apigames responded ${response.status}` };
    }
    const data = (await response.json()) as { data?: { status?: boolean; nickname?: string; message?: string } };
    return {
      valid: data.data?.status === true,
      playerName: data.data?.nickname,
      reason: data.data?.message,
    };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const refId = params.referenceId;
    const response = await fetch(`${BASE_URL}/transaksi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: this.username,
        signature: this.signature(refId),
        ref_id: refId,
        kode_produk: params.providerProductCode,
        tujuan: params.serverId ? `${params.playerId}${params.serverId}` : params.playerId,
      }),
    });

    const raw = (await response.json().catch(() => null)) as { data?: { status?: string; trx_id?: string; message?: string } } | null;
    if (!response.ok || !raw?.data) {
      return { success: false, reason: `Apigames responded ${response.status}`, raw };
    }
    // Their orders are typically async ("Pending" -> webhook/poll for final
    // state), so "success" here means "accepted", not "delivered" — the
    // order stays PENDING until getTopupStatus (or a callback, once that
    // endpoint is confirmed) reports SUCCESS/FAILED.
    return {
      success: raw.data.status !== 'Gagal',
      status: raw.data.status === 'Sukses' ? 'SUCCESS' : raw.data.status === 'Gagal' ? 'FAILED' : 'PENDING',
      providerTransactionId: raw.data.trx_id,
      reason: raw.data.message,
      canFallback: raw.data.status === 'Gagal',
      raw,
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const refId = providerTransactionId;
    const response = await fetch(`${BASE_URL}/status`, {
      signal: AbortSignal.timeout(8000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: this.username,
        signature: this.signature(refId),
        ref_id: providerTransactionId,
      }),
    });

    const raw = (await response.json().catch(() => null)) as { data?: { status?: string } } | null;
    const status = raw?.data?.status;
    return {
      status: status === 'Sukses' ? 'SUCCESS' : status === 'Gagal' ? 'FAILED' : 'PENDING',
      raw,
    };
  }
}
