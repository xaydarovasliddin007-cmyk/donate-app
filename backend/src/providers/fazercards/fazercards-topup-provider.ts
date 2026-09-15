import type {
  CreateTopupParams,
  CreateTopupResult,
  TopupProviderAdapter,
  TopupStatusResult,
  TopupValidatePlayerParams,
  TopupValidatePlayerResult,
} from '../topup-provider.js';

const BASE_URL = 'https://api.fzr.cards/api/v2';

/**
 * FazerCards' genshin_impact_global category needs its "server" field as
 * one of these four lowercase values — a real *region select*, unlike
 * every other category's free-text zone/server_id. The app's Genshin
 * Impact GameServer catalog (see prisma/seed.ts) uses different codes for
 * the same four regions since those double as this game's pricing tiers,
 * so the value has to be translated rather than passed through as-is.
 */
const GENSHIN_SERVER_MAP: Record<string, string> = {
  ASIA: 'asia',
  AMERICA: 'america',
  EU: 'europe',
  TW_HK_MO: 'tw_hk_mo',
};

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

interface FazerCardsCheckLoginResponse {
  ok?: boolean;
  can_refill?: boolean;
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
 * distinct code prefix instead:
 *   - `"telegram_premium:<months>"` → `POST /telegram/premium/buy`. Unlike
 *     every other endpoint here, its response shape was never confirmed
 *     (the docs excerpt only showed the request body) — this assumes the
 *     same `{ok, order:{id, status}}` shape as everything else, but treat
 *     that assumption as unverified.
 *   - `"steam_topup:<currency>:<amount>"` (e.g. "steam_topup:USD:10") →
 *     `POST /steam-topup/order`, `{steamLogin, currency, amount}`. This one
 *     IS confirmed to return `{ok, order:{id, status}}` (docs show a
 *     response example), and also gets a real `validatePlayer()` via
 *     `POST /steam-topup/check-login` instead of the generic
 *     non-empty-string fallback every other kind uses.
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

  /**
   * The generic /topups catalog's per-category `fields` schema isn't always
   * `{player_id, server_id}` — e.g. 8 Ball Pool and CODM use `user_id`,
   * Genshin Impact uses a `server` select instead of `server_id` (see the
   * category's own `fields` array from GET /topups/offers). Two optional
   * trailing segments let a `ProviderProduct` row override the field keys
   * without changing every existing "<category_id>:<offer_id>" code:
   * "<category_id>:<offer_id>[:<playerFieldKey>[:<serverFieldKey>]]".
   */
  private splitProductCode(
    providerProductCode: string,
  ): { categoryId: string; offerId: string; playerField: string; serverField: string } {
    const [categoryId, offerId, playerField, serverField] = providerProductCode.split(':');
    if (!categoryId || !offerId) {
      throw new Error(
        `Invalid FazerCards providerProductCode "${providerProductCode}" — expected ` +
          `"<category_id>:<offer_id>[:<playerFieldKey>[:<serverFieldKey>]]"`,
      );
    }
    return { categoryId, offerId, playerField: playerField || 'player_id', serverField: serverField || 'server_id' };
  }

  private splitSteamCode(providerProductCode: string): { currency: string; amount: string } {
    const [, currency, amount] = providerProductCode.split(':');
    if (!currency || !amount) {
      throw new Error(
        `Invalid FazerCards providerProductCode "${providerProductCode}" — expected "steam_topup:<currency>:<amount>"`,
      );
    }
    return { currency, amount };
  }

  /**
   * Real check for Steam (POST /steam-topup/check-login). Everything else
   * falls back to "any non-empty player ID is provisionally valid, and
   * createTopup()'s result is the real answer" — FazerCards' docs don't
   * describe a dedicated validate endpoint for the generic /topups catalog
   * or for Telegram Premium (same situation as the Digiflazz adapter).
   */
  async validatePlayer(params: TopupValidatePlayerParams): Promise<TopupValidatePlayerResult> {
    if (params.providerProductCode.startsWith('steam_topup:')) {
      const response = await fetch(`${BASE_URL}/steam-topup/check-login`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ steamLogin: params.playerId }),
      });
      const raw = (await response.json().catch(() => null)) as FazerCardsCheckLoginResponse | null;
      const valid = !!raw?.ok && raw.can_refill === true;
      return { valid, reason: valid ? undefined : 'This Steam login cannot be refilled' };
    }

    const valid = params.playerId.trim().length > 0;
    return { valid, reason: valid ? undefined : 'Player ID is required' };
  }

  private buildOrderRequest(params: CreateTopupParams): { url: string; body: unknown } {
    const { providerProductCode } = params;

    if (providerProductCode.startsWith('telegram_premium:')) {
      return {
        url: `${BASE_URL}/telegram/premium/buy`,
        body: { telegram_username: params.playerId, months: Number(providerProductCode.split(':')[1]) },
      };
    }

    if (providerProductCode.startsWith('steam_topup:')) {
      const { currency, amount } = this.splitSteamCode(providerProductCode);
      return {
        url: `${BASE_URL}/steam-topup/order`,
        body: { steamLogin: params.playerId, currency, amount: Number(amount) },
      };
    }

    const { categoryId, offerId, playerField, serverField } = this.splitProductCode(providerProductCode);
    // Genshin's "server" field is a region SELECT (see GENSHIN_SERVER_MAP)
    // fed by gameServerCode (the pricing-region GameServer the buyer picked
    // before checkout) — every other category's server-ish field is the
    // buyer's own free-text zone/server ID (serverId), which is a
    // different thing entirely and never needs translating.
    const serverValue =
      categoryId === 'genshin_impact_global'
        ? (params.gameServerCode ? GENSHIN_SERVER_MAP[params.gameServerCode] : undefined)
        : params.serverId;
    return {
      url: `${BASE_URL}/topups/order`,
      body: {
        category_id: categoryId,
        offer_id: offerId,
        fields: { [playerField]: params.playerId, ...(serverValue ? { [serverField]: serverValue } : {}) },
      },
    };
  }

  async createTopup(params: CreateTopupParams): Promise<CreateTopupResult> {
    const { url, body } = this.buildOrderRequest(params);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers({ 'Idempotency-Key': params.referenceId }),
      body: JSON.stringify(body),
    });

    const raw = (await response.json().catch(() => null)) as FazerCardsOrderResponse | null;
    if (!response.ok || !raw?.ok || !raw.order?.id) {
      return {
        success: false,
        reason: raw?.error ?? `FazerCards responded ${response.status}`,
        canFallback: raw?.ok === false && Boolean(raw.error),
        raw,
      };
    }

    return {
      // "failed" is the only terminal-failure status; "processing" and
      // "completed" both mean the order was accepted — getTopupStatus()
      // resolves "processing" into its final state later.
      success: raw.order.status !== 'failed',
      status: raw.order.status === 'completed' ? 'SUCCESS' : raw.order.status === 'failed' ? 'FAILED' : 'PENDING',
      providerTransactionId: raw.order.id,
      canFallback: raw.order.status === 'failed',
      raw,
    };
  }

  async getTopupStatus(providerTransactionId: string): Promise<TopupStatusResult> {
    const response = await fetch(`${BASE_URL}/orders/${providerTransactionId}`, {
      signal: AbortSignal.timeout(8000),
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
