import { env } from '../config/env.js';
import { ClickProvider } from './click/click-provider.js';
import { MockPaymentProvider } from './mock/mock-payment-provider.js';
import { MockTopupProvider } from './mock/mock-topup-provider.js';
import { PaymeProvider } from './payme/payme-provider.js';
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

// Payme/Click only register themselves once their credentials are present —
// same "wired but inert without config" pattern as Google Sign-In
// (AppConfig.isGoogleSignInConfigured on the mobile side).
if (env.PAYME_MERCHANT_ID && env.PAYME_SECRET_KEY) {
  paymentAdapters.PAYME = new PaymeProvider(env.PAYME_MERCHANT_ID, env.PAYME_TEST_MODE);
}
if (env.CLICK_MERCHANT_ID && env.CLICK_SERVICE_ID && env.CLICK_SECRET_KEY) {
  paymentAdapters.CLICK = new ClickProvider(env.CLICK_MERCHANT_ID, env.CLICK_SERVICE_ID);
}

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
