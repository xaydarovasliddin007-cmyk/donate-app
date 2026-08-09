import { MockPaymentProvider } from './mock/mock-payment-provider.js';
import { MockTopupProvider } from './mock/mock-topup-provider.js';
import type { PaymentProviderAdapter } from './payment-provider.js';
import type { TopupProviderAdapter } from './topup-provider.js';

/**
 * Maps a `providers.code` DB row to its adapter implementation. Adding a
 * real provider later is: write the adapter file, register it here — order
 * and payment logic never change.
 */
const topupAdapters: Record<string, TopupProviderAdapter> = {
  DEV_MOCK_TOPUP: new MockTopupProvider(),
};

const paymentAdapters: Record<string, PaymentProviderAdapter> = {
  DEV_MOCK_PAYMENT: new MockPaymentProvider(),
};

export function getTopupProvider(code: string): TopupProviderAdapter {
  const adapter = topupAdapters[code];
  if (!adapter) {
    throw new Error(`No topup provider adapter registered for code "${code}"`);
  }
  return adapter;
}

export function getPaymentProvider(code: string): PaymentProviderAdapter {
  const adapter = paymentAdapters[code];
  if (!adapter) {
    throw new Error(`No payment provider adapter registered for code "${code}"`);
  }
  return adapter;
}
