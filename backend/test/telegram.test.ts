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
});
