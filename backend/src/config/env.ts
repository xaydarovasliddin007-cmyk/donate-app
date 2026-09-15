import { config } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  config({ quiet: true });
  config({ path: '.env.telegram', quiet: true });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_VERSION: z.string().default('v1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .default('uzdonate_jwt_access_secret_production_fallback_key_2026_safe'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .default('uzdonate_jwt_refresh_secret_production_fallback_key_2026_safe'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Deliberately a separate signing secret from the customer JWTs above: a
  // leaked customer-facing secret must never be enough to forge admin access.
  ADMIN_JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'ADMIN_JWT_ACCESS_SECRET must be at least 32 characters')
    .default('uzdonate_admin_jwt_secret_production_fallback_key_2026_safe'),
  ADMIN_JWT_ACCESS_TTL: z.string().default('15m'),
  ADMIN_JWT_REFRESH_TTL: z.string().default('7d'),

  // Optional on purpose: Google sign-in is a real, fully-implemented feature
  // but requires a GCP OAuth client the operator must create. Without it,
  // POST /auth/google returns a clear 503 instead of the app refusing to boot.
  GOOGLE_CLIENT_ID: z
    .string()
    .trim()
    .min(1)
    .default('223785346997-vphv1k7i131r72orkhj05dnvvhocd9br.apps.googleusercontent.com'),

  // Optional: admin alerts (new order, payment, top-up, refund, provider
  // error, ...) via a Telegram bot. Both must be set for notifications to
  // actually send; if either is missing, the notifier silently no-ops
  // rather than failing the request that triggered it.
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().trim().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/).optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  SUPPORT_TELEGRAM_URL: z.string().url().default('https://t.me/The_Anonimous_uzb'),

  // Optional: Payme and Click are real, fully-wired payment adapters (see
  // src/providers/payme, src/providers/click) that only register themselves
  // in the provider registry once their credentials are present — same
  // pattern as GOOGLE_CLIENT_ID above. A merchant account with either
  // gateway can't be invented; see backend/README.md for setup.
  PAYME_MERCHANT_ID: z.string().trim().min(1).optional(),
  PAYME_SECRET_KEY: z.string().trim().min(1).optional(),
  PAYME_TEST_MODE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),

  CLICK_MERCHANT_ID: z.string().trim().min(1).optional(),
  CLICK_SERVICE_ID: z.string().trim().min(1).optional(),
  CLICK_SECRET_KEY: z.string().trim().min(1).optional(),

  // Optional: Digiflazz — a real multi-seller game top-up marketplace
  // (buyer price = cheapest of several competing sellers per their own
  // docs), the primary top-up provider. Same "wired but inert without
  // credentials" pattern as above. See
  // src/providers/digiflazz/digiflazz-topup-provider.ts — its endpoints
  // and signature formula are taken from Digiflazz's public API docs, not
  // guessed. Requires whitelisting this server's IP in the Digiflazz
  // dashboard — see backend/README.md "Digiflazz top-up setup".
  DIGIFLAZZ_USERNAME: z.string().trim().min(1).optional(),
  DIGIFLAZZ_API_KEY: z.string().trim().min(1).optional(),

  // Optional: Apigames.id — a secondary/fallback wholesale H2H top-up
  // aggregator (routes orders across Smile.one/UniPin/Kiosgamer/etc.).
  // See src/providers/apigames/apigames-topup-provider.ts — unlike
  // Digiflazz's, its request/response field mapping is a placeholder
  // pending the real docs.apigames.id reference (a JS-rendered page that
  // couldn't be read programmatically), since that account can't be
  // created on the operator's behalf.
  APIGAMES_USERNAME: z.string().trim().min(1).optional(),
  APIGAMES_API_KEY: z.string().trim().min(1).optional(),

  // Optional: FazerCards — a B2B wholesale reseller platform, cheaper than
  // Apigames/MRCODA per-diamond on the games checked so far and fundable
  // via USDT (unlike Digiflazz/Apigames' Indonesian bank/e-wallet-only
  // deposits). See src/providers/fazercards/fazercards-topup-provider.ts —
  // built from FazerCards' own published API docs, still unverified
  // against a live account/order.
  FAZERCARDS_API_KEY: z.string().trim().min(1).optional(),

  // Optional: MooGold — Global wholesale top-up provider (moogold.com),
  // optimal for PUBG Mobile UC and Free Fire Diamonds with USDT deposits.
  MOOGOLD_PARTNER_ID: z.string().trim().min(1).optional(),
  MOOGOLD_SECRET_KEY: z.string().trim().min(1).optional(),

  // Optional: Smile.One — Direct partner for Mobile Legends: Bang Bang
  // (Moonton) and Free Fire (partner.smile.one) with role/nickname validation.
  SMILEONE_UID: z.string().trim().min(1).optional(),
  SMILEONE_EMAIL: z.string().trim().min(1).optional(),
  SMILEONE_API_KEY: z.string().trim().min(1).optional(),

  // Optional: shared secret the Telegram bank-notification listener script
  // (scripts/humo-listener.ts) must send on every request to
  // POST /webhooks/humo-transaction. Without it, that endpoint refuses all
  // requests — auto-verification of card-transfer top-ups simply doesn't
  // run, and top-ups fall back to manual admin review (see
  // modules/topup/topup.service.ts).
  HUMO_WEBHOOK_SECRET: z.string().trim().min(1).optional(),

  // Optional: outgoing email (registration verification codes) via SMTP —
  // same "wired but needs credentials" pattern as the above. Without these,
  // src/lib/mailer.ts logs the email content instead of sending it, so the
  // verification flow stays fully testable in dev.
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().trim().min(1).optional(),
  SMTP_FROM: z.string().trim().min(1).default('UZDONATE <no-reply@uzdonate.dev>'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === 'production') {
    const keys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_ACCESS_SECRET'] as const;
    for (const key of keys) {
      if (!process.env[key] || /fallback|replace-with/i.test(parsed.data[key])) {
        throw new Error(`${key} must be a private random secret in production`);
      }
    }
    if (new Set(keys.map((key) => parsed.data[key])).size !== keys.length) {
      throw new Error('Customer and admin signing secrets must be different');
    }
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
