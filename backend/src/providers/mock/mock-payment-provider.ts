import type {
  CreatePaymentIntentParams,
  CreatePaymentIntentResult,
  PaymentProviderAdapter,
  PaymentStatusResult,
} from '../payment-provider.js';

/**
 * Development/test payment provider. It never marks itself SUCCEEDED on
 * creation — a payment intent always starts PENDING, exactly like a real
 * redirect-based gateway would, and only transitions when a webhook-style
 * confirmation arrives (see modules/payments/payments.routes.ts's
 * dev-only simulate endpoint). This keeps the state machine and webhook
 * processing paths genuinely exercised instead of short-circuited.
 */
export class MockPaymentProvider implements PaymentProviderAdapter {
  readonly code = 'DEV_MOCK_PAYMENT';

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult> {
    return {
      providerRef: `MOCKPAY-${params.referenceId.slice(0, 8)}`,
      status: 'PENDING',
      raw: { simulated: true },
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentStatusResult> {
    return { status: 'PENDING', raw: { providerRef, simulated: true } };
  }
}
