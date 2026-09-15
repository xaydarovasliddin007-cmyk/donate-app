import { createHash } from 'node:crypto';
import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://www.smile.one/smilecoin/api';

interface SmileOneResponse<T = unknown> {
  status?: number;
  message?: string;
  data?: T;
}

interface SmileOneGetRoleData {
  username?: string;
  zone?: string;
}

interface SmileOneOrderData {
  order_id?: string | number;
}

interface SmileOneQueryOrderData {
  status?: string | number;
}

/**
 * Smile.One — Official direct partner platform (partner.smile.one) for Mobile Legends:
 * Bang Bang (Moonton) and Free Fire (Garena). Offers in-game player ID/nickname
 * verification and high-volume wholesale pricing.
 *
 * `providerProductCode` typically encodes `"<product_slug>:<product_id>"` (e.g. "mobilelegends:13").
 */
export class SmileOneTopupProvider implements TopupProviderAdapter {
  readonly code = 'SMILEONE';

  constructor(
    private readonly uid: string,
    private readonly email: string,
    private readonly apiKey: string,
  ) {}

  private generateSign(params: Record<string, string | number>): string {
    const keys = Object.keys(params).sort();
    const queryParts = keys.map((k) => `${k}=${params[k]}`);
    const stringToSign = `${queryParts.join('&')}&${this.apiKey}`;
    return createHash('md5').update(stringToSign).digest('hex');
  }

  private splitCode(providerProductCode: string): { productSlug: string; productId: string } {
    const [slug, id] = providerProductCode.split(':');
    return {
      productSlug: slug || 'mobilelegends',
      productId: id || providerProductCode,
    };
  }

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    if (!params.playerId || params.playerId.trim().length === 0) {
      return { valid: false, reason: 'Player ID cannot be empty' };
    }

    const { productSlug } = this.splitCode(params.providerProductCode);
    const time = Math.floor(Date.now() / 1000);

    const signParams: Record<string, string | number> = {
      email: this.email,
      product: productSlug,
      time,
      uid: this.uid,
      userid: params.playerId,
    };

    if (params.serverId) {
      signParams.zoneid = params.serverId;
    }

    const sign = this.generateSign(signParams);

    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(signParams)) {
        form.set(k, String(v));
      }
      form.set('sign', sign);

      const response = await fetch(`${BASE_URL}/getrole`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const data = (await response.json().catch(() => null)) as SmileOneResponse<SmileOneGetRoleData> | null;

      if (!response.ok || !data) {
        return { valid: false, reason: `Smile.One HTTP ${response.status}` };
      }

      if (data.status === 200 && data.data?.username) {
        return { valid: true, playerName: data.data.username };
      }

      // If check-role returns error (e.g. invalid zone or user id)
      if (data.status !== 200) {
        return { valid: false, reason: data.message || 'Player not found in Smile.One' };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, reason: err instanceof Error ? err.message : 'Network error validating player' };
    }
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const { productSlug, productId } = this.splitCode(params.providerProductCode);
    const time = Math.floor(Date.now() / 1000);

    const signParams: Record<string, string | number> = {
      email: this.email,
      product: productSlug,
      productid: productId,
      time,
      uid: this.uid,
      userid: params.playerId,
    };

    if (params.serverId) {
      signParams.zoneid = params.serverId;
    }

    const sign = this.generateSign(signParams);

    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(signParams)) {
        form.set(k, String(v));
      }
      form.set('sign', sign);

      const response = await fetch(`${BASE_URL}/createorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const data = (await response.json().catch(() => null)) as SmileOneResponse<SmileOneOrderData> | null;

      if (!response.ok || !data) {
        return {
          success: false,
          reason: data?.message || `Smile.One HTTP ${response.status}`,
          raw: data,
        };
      }

      const orderId = String(data.data?.order_id ?? '');
      if (data.status === 200 && orderId) {
        return {
          success: true,
          status: 'PENDING',
          providerTransactionId: orderId,
          raw: data,
        };
      }

      return {
        success: false,
        reason: data.message || 'Smile.One order failed',
        raw: data,
      };
    } catch (err) {
      return {
        success: false,
        reason: err instanceof Error ? err.message : 'Network error calling Smile.One API',
      };
    }
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const time = Math.floor(Date.now() / 1000);
    const signParams: Record<string, string | number> = {
      email: this.email,
      orderid: providerTransactionId,
      time,
      uid: this.uid,
    };
    const sign = this.generateSign(signParams);

    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(signParams)) {
        form.set(k, String(v));
      }
      form.set('sign', sign);

      const response = await fetch(`${BASE_URL}/orderquery`, {
        signal: AbortSignal.timeout(8000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const data = (await response.json().catch(() => null)) as SmileOneResponse<SmileOneQueryOrderData> | null;
      if (!response.ok || !data) {
        return { status: 'PENDING', raw: data };
      }

      if (data.status === 200) {
        return { status: 'SUCCESS', raw: data };
      }

      return { status: 'PENDING', raw: data };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
