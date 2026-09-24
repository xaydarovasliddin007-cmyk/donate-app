import { env, isProduction } from '../config/env.js';
import { ServiceUnavailableError } from '../lib/errors.js';
import { ApiGamesTopupProvider } from './apigames/apigames-topup-provider.js';
import { ClickProvider } from './click/click-provider.js';
import { DigiflazzTopupProvider } from './digiflazz/digiflazz-topup-provider.js';
import { FazerCardsTopupProvider } from './fazercards/fazercards-topup-provider.js';
import { MooGoldTopupProvider } from './moogold/moogold-topup-provider.js';
import { SmileOneTopupProvider } from './smileone/smileone-topup-provider.js';
import { ReSellCodesTopupProvider } from './resellcodes/resellcodes-topup-provider.js';
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
const defaultTopupAdapter: TopupProviderAdapter = new MockTopupProvider();
const defaultPaymentAdapter: PaymentProviderAdapter = new MockPaymentProvider();

const topupAdapters: Record<string, TopupProviderAdapter> = {
  DEV_MOCK_TOPUP: defaultTopupAdapter,
  // A second isolated adapter lets development and integration tests verify
  // cheapest-provider selection and fallback without touching a real API.
  DEV_MOCK_TOPUP_BACKUP: new MockTopupProvider('DEV_MOCK_TOPUP_BACKUP'),
};

const paymentAdapters: Record<string, PaymentProviderAdapter> = {
  DEV_MOCK_PAYMENT: defaultPaymentAdapter,
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
if (env.DIGIFLAZZ_USERNAME && env.DIGIFLAZZ_API_KEY) {
  topupAdapters.DIGIFLAZZ = new DigiflazzTopupProvider(env.DIGIFLAZZ_USERNAME, env.DIGIFLAZZ_API_KEY);
}
if (env.APIGAMES_USERNAME && env.APIGAMES_API_KEY) {
  topupAdapters.APIGAMES = new ApiGamesTopupProvider(env.APIGAMES_USERNAME, env.APIGAMES_API_KEY);
}
if (env.FAZERCARDS_API_KEY) {
  topupAdapters.FAZERCARDS = new FazerCardsTopupProvider(env.FAZERCARDS_API_KEY);
}
if (env.MOOGOLD_PARTNER_ID && env.MOOGOLD_SECRET_KEY) {
  topupAdapters.MOOGOLD = new MooGoldTopupProvider(env.MOOGOLD_PARTNER_ID, env.MOOGOLD_SECRET_KEY);
}
if (env.SMILEONE_UID && env.SMILEONE_EMAIL && env.SMILEONE_API_KEY) {
  topupAdapters.SMILEONE = new SmileOneTopupProvider(env.SMILEONE_UID, env.SMILEONE_EMAIL, env.SMILEONE_API_KEY);
}
if (env.RSC_API_KEY && env.RSC_USD_UZS_RATE) {
  topupAdapters.RESELLCODES = new ReSellCodesTopupProvider(env.RSC_API_KEY, env.RSC_USD_UZS_RATE);
}

export function isTopupProviderConfigured(code: string): boolean {
  return Boolean(topupAdapters[code]) && !(isProduction && (code.startsWith('DEV_') || code === 'APIGAMES'));
}

export function isProviderAdapterConfigured(code: string, type: 'PAYMENT' | 'TOPUP'): boolean {
  if (type === 'TOPUP') return isTopupProviderConfigured(code);
  return Boolean(paymentAdapters[code]) && !(isProduction && code.startsWith('DEV_'));
}

export function getTopupProvider(code: string): TopupProviderAdapter {
  const adapter = topupAdapters[code];
  if (!adapter || (isProduction && (code.startsWith('DEV_') || code === 'APIGAMES'))) {
    throw new ServiceUnavailableError('Fulfillment provider is not configured');
  }
  return adapter;
}

export function getPaymentProvider(code: string): PaymentProviderAdapter {
  const adapter = paymentAdapters[code];
  if (!adapter || (isProduction && code.startsWith('DEV_'))) {
    throw new ServiceUnavailableError('Payment provider is not configured');
  }
  return adapter;
}
