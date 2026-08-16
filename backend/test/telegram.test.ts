import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('notifyAdmins', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
});
