import { createHash } from 'node:crypto';
import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://api.digiflazz.com/v1';

interface DigiflazzTransactionResponse {
  data?: {
    ref_id?: string;
    status?: 'Sukses' | 'Pending' | 'Gagal';
    rc?: string;
    message?: string;
    sn?: string;
  };
}

/**
 * Digiflazz — a real multi-seller marketplace (not a single-supplier
 * aggregator like Apigames.id): each product can have several competing
 * sellers, and the price list API returns "the cheapest price or best
 * commission from registered sellers" per their own docs. Chosen as the
 * primary top-up provider over apigames-topup-provider.ts for that reason
 * — structurally better pricing than a fixed-margin single source.
 *
 * Endpoints, fields, and the signature formula below are taken directly
 * from Digiflazz's public technical documentation
 * (developer.digiflazz.com/api/buyer/...) and are real, not placeholders —
 * unlike the Apigames adapter, this hasn't needed any guessing. Still
 * untested against a live account/real order, since that requires
 * credentials that can't be created on the operator's behalf.
 *
 * Operational requirement: Digiflazz requires whitelisting this server's
 * outbound IP in their buyer dashboard before any request succeeds — see
 * backend/README.md "Digiflazz top-up setup".
 */
export class DigiflazzTopupProvider implements TopupProviderAdapter {
  readonly code = 'DIGIFLAZZ';

  constructor(
    private readonly username: string,
    private readonly apiKey: string,
  ) {}

  private sign(suffix: string): string {
    return createHash('md5').update(`${this.username}${this.apiKey}${suffix}`).digest('hex');
  }

  /**
   * Digiflazz has no dedicated "validate player" endpoint for most games —
   * player/server ID correctness is checked as part of the transaction
   * itself (a wrong ID fails with status "Gagal" and a message). Callers
   * that want a pre-purchase check should treat any non-empty ID as
   * provisionally valid and rely on createTopup()'s result for the real
   * answer, same as this method does.
   */
  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    const valid = params.playerId.trim().length > 0;
    return { valid, reason: valid ? undefined : 'Player ID is required' };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const response = await fetch(`${BASE_URL}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        buyer_sku_code: params.providerProductCode,
        customer_no: params.serverId ? `${params.playerId}${params.serverId}` : params.playerId,
        ref_id: params.referenceId,
        sign: this.sign(params.referenceId),
      }),
    });

    const raw = (await response.json().catch(() => null)) as DigiflazzTransactionResponse | null;
    const data = raw?.data;
    if (!response.ok || !data) {
      return { success: false, reason: `Digiflazz responded ${response.status}`, raw };
    }

    return {
      // "Sukses" and "Pending" both mean the order was accepted — Pending
      // resolves later via getTopupStatus() or the configured webhook.
      // Only "Gagal" is a real failure.
      success: data.status !== 'Gagal',
      providerTransactionId: data.ref_id ?? params.referenceId,
      reason: data.message,
      raw,
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    // Per Digiflazz's docs, a pending transaction's current state is
    // fetched by resubmitting the *same* ref_id to the transaction
    // endpoint (not a separate status GET) — Digiflazz recognizes the
    // duplicate ref_id and returns its latest status instead of creating a
    // second order.
    const response = await fetch(`${BASE_URL}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        ref_id: providerTransactionId,
        sign: this.sign(providerTransactionId),
      }),
    });

    const raw = (await response.json().catch(() => null)) as DigiflazzTransactionResponse | null;
    const status = raw?.data?.status;
    return {
      status: status === 'Sukses' ? 'SUCCESS' : status === 'Gagal' ? 'FAILED' : 'PENDING',
      raw,
    };
  }
}
