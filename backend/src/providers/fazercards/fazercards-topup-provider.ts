import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://api.fzr.cards/api/v2';

interface FazerCardsOrderResponse {
  ok?: boolean;
  order?: {
    id?: string;
    kind?: string;
    status?: 'processing' | 'completed' | 'failed' | string;
  };
  error?: string;
  code?: string;
}

/**
 * FazerCards — a B2B wholesale reseller platform (reseller.fazercards.com)
 * chosen for its per-diamond price on Mobile Legends packages coming out
 * roughly 30-35% below MRCODA's consumer-facing storefront prices for the
 * same denomination, and for accepting USDT (TRC20/BEP20/TON/Aptos) balance
 * top-ups — unlike Digiflazz/Apigames, which need an Indonesian bank/e-wallet
 * to fund, USDT is actually reachable from Uzbekistan.
 *
 * Unlike apigames-topup-provider.ts, this one is built against FazerCards'
 * own published REST v2 docs (reseller.fazercards.com/en/docs) — real
 * endpoint paths, auth header, and request/response shapes, not guessed.
 * Still unverified against a live account/order, since that account can't
 * be created on the operator's behalf — see backend/README.md "FazerCards
 * top-up setup" before this ever handles a real order.
 *
 * `providerProductCode` normally encodes FazerCards' two-part product id as
 * `"<category_id>:<offer_id>"` (e.g. "mobile_legends_global:78_8_diamonds")
 * since their catalog needs both to place an order, while our shared
 * interface only carries one code string per `ProviderProduct`. Products
 * outside that generic `/topups` catalog use their own endpoint and a
 * distinct code prefix instead — currently just `"telegram_premium:<months>"`
 * for `POST /telegram/premium/buy`, which — unlike the generic order
 * endpoint above — has never been confirmed to return the same
 * `{ok, order:{id, status}}` shape (the docs excerpt only showed its
 * request body, not a response example); this assumes it does, matching
 * every other endpoint's pattern, but treat that as unverified too.
 */
export class FazerCardsTopupProvider implements TopupProviderAdapter {
  readonly code = 'FAZERCARDS';

  constructor(private readonly apiKey: string) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...extra,
    };
  }

  private splitProductCode(providerProductCode: string): { categoryId: string; offerId: string } {
    const [categoryId, offerId] = providerProductCode.split(':');
    if (!categoryId || !offerId) {
      throw new Error(
        `Invalid FazerCards providerProductCode "${providerProductCode}" — expected "<category_id>:<offer_id>"`,
      );
    }
    return { categoryId, offerId };
  }

  /**
   * FazerCards' docs don't describe a dedicated player-lookup/validate
   * endpoint in the excerpt available here — same situation as Digiflazz,
   * so this applies the same fallback: any non-empty player ID is
   * provisionally valid, and createTopup()'s result is the real answer.
   * Revisit once the full API Cookbook / OpenAPI schema is available.
   */
  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    const valid = params.playerId.trim().length > 0;
    return { valid, reason: valid ? undefined : 'Player ID is required' };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const url = params.providerProductCode.startsWith('telegram_premium:')
      ? `${BASE_URL}/telegram/premium/buy`
      : `${BASE_URL}/topups/order`;
    const body = params.providerProductCode.startsWith('telegram_premium:')
      ? {
          telegram_username: params.playerId,
          months: Number(params.providerProductCode.split(':')[1]),
        }
      : (() => {
          const { categoryId, offerId } = this.splitProductCode(params.providerProductCode);
          return {
            category_id: categoryId,
            offer_id: offerId,
            fields: {
              player_id: params.playerId,
              ...(params.serverId ? { server_id: params.serverId } : {}),
            },
          };
        })();

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers({ 'Idempotency-Key': params.referenceId }),
      body: JSON.stringify(body),
    });

    const raw = (await response.json().catch(() => null)) as FazerCardsOrderResponse | null;
    if (!response.ok || !raw?.ok || !raw.order?.id) {
      return { success: false, reason: raw?.error ?? `FazerCards responded ${response.status}`, raw };
    }

    return {
      // "failed" is the only terminal-failure status; "processing" and
      // "completed" both mean the order was accepted — getTopupStatus()
      // resolves "processing" into its final state later.
      success: raw.order.status !== 'failed',
      providerTransactionId: raw.order.id,
      raw,
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const response = await fetch(`${BASE_URL}/orders/${providerTransactionId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    const raw = (await response.json().catch(() => null)) as FazerCardsOrderResponse | null;
    const status = raw?.order?.status;
    return {
      status: status === 'completed' ? 'SUCCESS' : status === 'failed' ? 'FAILED' : 'PENDING',
      raw,
    };
  }
}
