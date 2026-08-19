import type {
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  PaymentProviderAdapter,
  PaymentStatusResult,
} from '../payment-provider.js';

/**
 * Click (click.uz) — Uzbekistan's other major payment gateway. Like Payme,
 * the actual state transition happens through Click calling *our* webhook
 * (Prepare then Complete, see click-webhook.ts) after the user pays on
 * Click's own checkout page — `createPaymentIntent` only builds that
 * redirect URL.
 */
export class ClickProvider implements PaymentProviderAdapter {
  readonly code = 'CLICK';

  constructor(
    private readonly merchantId: string,
    private readonly serviceId: string,
  ) {}

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    // Click amounts are whole UZS (not tiyin) — convert from our minor units.
    const amountMajor = (params.amountMinor / 100).toFixed(2);
    const url = new URL('https://my.click.uz/services/pay');
    url.searchParams.set('service_id', this.serviceId);
    url.searchParams.set('merchant_id', this.merchantId);
    url.searchParams.set('amount', amountMajor);
    // Echoed back to us on every Prepare/Complete call as merchant_trans_id —
    // carries our own Payment id, same role as Payme's ac.payment_id.
    url.searchParams.set('transaction_param', params.referenceId);

    return {
      providerRef: `CLICK-${params.referenceId}`,
      status: 'PENDING',
      checkoutUrl: url.toString(),
      raw: { merchantId: this.merchantId, serviceId: this.serviceId },
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    // Click, like Payme, drives state through the webhook rather than a
    // simple polling GET — our own Payment row is the source of truth.
    return { status: 'PENDING', raw: { providerRef, note: 'status is webhook-driven, see click-webhook.ts' } };
  }
}
