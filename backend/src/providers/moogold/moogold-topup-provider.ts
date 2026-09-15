import { createHmac } from 'node:crypto';
import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://moogold.com/wp-json/v1/api';

interface MooGoldOrderResponse {
  status?: boolean | number | string;
  message?: string;
  order_id?: number | string;
  data?: {
    order_id?: number | string;
    status?: string;
  };
}

interface MooGoldOrderDetailResponse {
  status?: boolean | number | string;
  message?: string;
  data?: {
    order_id?: number | string;
    order_status?: string;
  };
}

/**
 * MooGold — Global wholesale B2B game top-up platform (moogold.com).
 * Widely used across CIS/Uzbekistan for PUBG Mobile UC, Free Fire Diamonds,
 * and Steam/games top-up. Supports automated API ordering and USDT (TRC20/BEP20)
 * wallet deposits.
 *
 * `providerProductCode` typically encodes `"<category_id>:<product_id>"` (e.g. "12:1052" for PUBG UC).
 */
export class MooGoldTopupProvider implements TopupProviderAdapter {
  readonly code = 'MOOGOLD';

  constructor(
    private readonly partnerId: string,
    private readonly secretKey: string,
  ) {}

  private getAuthHeaders(path: string, payload: Record<string, unknown>): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadStr = JSON.stringify(payload);
    const stringToSign = `${payloadStr}${timestamp}${path}`;
    const auth = createHmac('sha256', this.secretKey).update(stringToSign).digest('hex');
    const basicAuth = Buffer.from(`${this.partnerId}:${this.secretKey}`).toString('base64');

    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
      auth,
      timestamp,
    };
  }

  private splitCode(providerProductCode: string): { categoryId: string; productId: string } {
    const [cat, prod] = providerProductCode.split(':');
    return {
      categoryId: cat || '12',
      productId: prod || providerProductCode,
    };
  }

  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    if (!params.playerId || params.playerId.trim().length === 0) {
      return { valid: false, reason: 'Player ID cannot be empty' };
    }
    return { valid: true };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const path = 'order/create_order';
    const { categoryId, productId } = this.splitCode(params.providerProductCode);

    const payload: Record<string, unknown> = {
      category: categoryId,
      product_id: productId,
      quantity: '1',
      'User ID': params.playerId,
      partnerOrderId: params.referenceId,
    };

    if (params.serverId) {
      payload['Server ID'] = params.serverId;
      payload['Zone ID'] = params.serverId;
    }

    try {
      const response = await fetch(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: this.getAuthHeaders(path, payload),
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as MooGoldOrderResponse | null;

      if (!response.ok || !data) {
        return {
          success: false,
          reason: data?.message || `MooGold HTTP ${response.status}`,
          canFallback: Boolean(data),
          raw: data,
        };
      }

      const orderId = String(data.order_id ?? data.data?.order_id ?? '');
      const isSuccess = data.status === true || data.status === 200 || data.status === 'success' || !!orderId;

      if (isSuccess && orderId) {
        return {
          success: true,
          status: 'PENDING',
          providerTransactionId: orderId,
          raw: data,
        };
      }

      return {
        success: false,
        reason: data.message || 'MooGold order creation rejected',
        canFallback: true,
        raw: data,
      };
    } catch (err) {
      return {
        success: false,
        reason: err instanceof Error ? err.message : 'Network error calling MooGold API',
      };
    }
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const path = 'order/order_detail';
    const payload: Record<string, unknown> = {
      order_id: providerTransactionId,
    };

    try {
      const response = await fetch(`${BASE_URL}/${path}`, {
        signal: AbortSignal.timeout(8000),
        method: 'POST',
        headers: this.getAuthHeaders(path, payload),
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as MooGoldOrderDetailResponse | null;
      if (!response.ok || !data) {
        return { status: 'PENDING', raw: data };
      }

      const orderStatus = (data.data?.order_status || '').toLowerCase();
      if (orderStatus === 'completed' || orderStatus === 'success') {
        return { status: 'SUCCESS', raw: data };
      }
      if (orderStatus === 'failed' || orderStatus === 'refunded' || orderStatus === 'cancelled') {
        return { status: 'FAILED', raw: data };
      }

      return { status: 'PENDING', raw: data };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
