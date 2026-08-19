import type {
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  PaymentProviderAdapter,
  PaymentStatusResult,
} from '../payment-provider.js';

/**
 * Payme (paycom.uz) — Uzbekistan's largest payment gateway. Unlike a typical
 * REST provider, Payme never returns a transaction id to us up front: the
 * user is redirected to a checkout URL we construct, and Payme's own servers
 * then call *our* webhook (see payme-webhook.ts) to create/confirm/cancel the
 * transaction. `createPaymentIntent` here only builds that redirect URL —
 * the real status transition happens through the webhook, exactly like the
 * dev mock provider's PENDING-until-webhook design.
 */
export class PaymeProvider implements PaymentProviderAdapter {
  readonly code = 'PAYME';

  constructor(
    private readonly merchantId: string,
    private readonly testMode: boolean,
  ) {}

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    // Payme's checkout params are ";"-joined "key=value" pairs, base64-encoded.
    // `ac.<name>` becomes an "account" field Payme echoes back on every
    // webhook call — we use it to carry our own Payment id.
    const rawParams = [
      `m=${this.merchantId}`,
      `ac.payment_id=${params.referenceId}`,
      // Payme amounts are tiyin (1/100 UZS) — the same minor-unit convention
      // this codebase already uses for amountMinor, so no conversion needed.
      `a=${params.amountMinor}`,
    ].join(';');
    const encoded = Buffer.from(rawParams, 'utf8').toString('base64');
    const host = this.testMode ? 'test.paycom.uz' : 'checkout.paycom.uz';

    return {
      providerRef: `PAYME-${params.referenceId}`,
      status: 'PENDING',
      checkoutUrl: `https://${host}/${encoded}`,
      raw: { merchantId: this.merchantId, testMode: this.testMode },
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    // Payme pushes state to us via webhook (CreateTransaction/
    // PerformTransaction/CancelTransaction) rather than exposing a simple
    // polling GET — our own Payment row (updated by the webhook) is the
    // source of truth. This is a best-effort fallback for callers that poll.
    return { status: 'PENDING', raw: { providerRef, note: 'status is webhook-driven, see payme-webhook.ts' } };
  }
}
