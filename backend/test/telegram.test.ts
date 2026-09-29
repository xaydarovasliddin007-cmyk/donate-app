import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('notifyAdmins', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('no-ops without making a network call when TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID are unset', async () => {
    // This dev environment genuinely has neither configured (see .env.example) —
    // exercising the real, unmodified env module is itself the test.
    const { notifyAdmins } = await import('../src/lib/telegram.js');

    notifyAdmins('this must never be sent');

    // Fire-and-forget — give any (incorrectly) scheduled microtask a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('attaches approve and reject buttons to bankomat receipt photos', async () => {
    vi.stubEnv('TOPUP_REVIEW_BOT_TOKEN', '123456789:test-token');
    vi.stubEnv('TOPUP_REVIEW_CHAT_ID', '123456789');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 88 } }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { sendTopUpReceiptPhoto } = await import('../src/lib/telegram.js');
    const requestId = '9efc2f4e-7b3b-4d0a-84af-628357311afe';

    await sendTopUpReceiptPhoto({
      image: Buffer.from('image'), mimeType: 'image/jpeg', fileName: 'receipt.jpg',
      requestId, userLabel: 'Test user', amount: '50 000 so‘m',
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const keyboard = JSON.parse(String(body.get('reply_markup'))) as {
      inline_keyboard: { text: string; callback_data: string }[][];
    };
    expect(keyboard.inline_keyboard[0]?.map((button) => button.text)).toEqual(['✅ Tasdiqlash', '❌ Rad etish']);
    expect(keyboard.inline_keyboard[0]?.map((button) => button.callback_data)).toEqual([
      `topup:approve:${requestId}`,
      `topup:reject:${requestId}`,
    ]);
  });

  it('registers the store bot webhook for start messages and payment updates', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '123456789:test-store-token');
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'isolated-store-webhook-secret-32-bytes');
    vi.stubEnv('PUBLIC_APP_URL', 'https://donate.example');
    vi.stubEnv('API_VERSION', 'v1');
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: true }), { status: 200 },
    ));
    globalThis.fetch = fetchMock;
    const { configureStoreBotWebhook } = await import('../src/modules/telegram/telegram-bot.js');

    await configureStoreBotWebhook();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.telegram.org/bot123456789:test-store-token/setWebhook');
    expect(JSON.parse(String(options?.body))).toMatchObject({
      url: 'https://donate.example/api/v1/telegram/webhook',
      secret_token: 'isolated-store-webhook-secret-32-bytes',
      allowed_updates: ['message', 'pre_checkout_query'],
      drop_pending_updates: false,
    });
  });
});
