/**
 * Contract every payment provider (Payme, Click, Uzum, ...) must implement.
 * Flutter never talks to a payment provider directly — only to our backend,
 * which talks to this interface. Provider credentials live only inside a
 * concrete adapter's own module, read from environment variables there —
 * never passed through from the client and never logged.
 */
export interface PaymentProviderAdapter {
  readonly code: string;

  createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult>;
  getPaymentStatus(providerRef: string): Promise<PaymentStatusResult>;
}

export interface CreatePaymentIntentParams {
  /** Our payment ID — passed through for provider-side tracing. */
  referenceId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export type ProviderPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface CreatePaymentIntentResult {
  providerRef: string;
  status: ProviderPaymentStatus;
  /** Where to send the user to complete payment, if the provider is redirect-based. */
  checkoutUrl?: string;
  raw?: unknown;
}

export interface PaymentStatusResult {
  status: ProviderPaymentStatus;
  raw?: unknown;
}
