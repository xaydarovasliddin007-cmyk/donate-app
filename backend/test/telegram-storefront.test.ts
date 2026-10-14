import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('../src/modules/telegram/telegram-api.js', () => ({
  telegramApi: apiMock,
  TelegramApiError: class TelegramApiError extends Error {
    constructor(public readonly description: string) { super(description); }
  },
}));

import { TelegramApiError } from '../src/modules/telegram/telegram-api.js';
import { isStorefrontCommand, sendStorefrontCommand, STORE_BOT_DESCRIPTIONS, storeBotCommands, storefrontReply } from '../src/modules/telegram/telegram-storefront.js';

const config = { publicAppUrl: 'https://donate.example', supportUrl: 'https://t.me/example_support', release: 'release-42' };

describe('Telegram storefront presentation', () => {
  beforeEach(() => apiMock.mockReset().mockResolvedValue(true));

  it('uses the brand card, escapes the user name and preserves the release link', () => {
    const reply = storefrontReply('/start', 'uz', '<Ali & Vali>', config);
    expect(reply.photo).toBe('https://donate.example/webapp/assets-store/brand-bot-card.png');
    expect(reply.text).toContain('&lt;Ali &amp; Vali&gt;');
    expect(reply.text.length).toBeLessThan(1024);
    expect(reply.reply_markup.inline_keyboard[0]?.[0]).toMatchObject({
      text: "Do'konni ochish", web_app: { url: 'https://donate.example/webapp/?v=release-42' },
    });
  });

  it('gives help, payment support and prices their own localized instructions', () => {
    const help = storefrontReply('/help', 'ru-RU', undefined, config);
    const support = storefrontReply('/paysupport', 'ru', undefined, config);
    const prices = storefrontReply('/prices', 'uz', undefined, config);
    expect(help.text).toContain('Как оформить заказ');
    expect(help.text).toContain('1. Выберите игру');
    expect(support.text).toContain('номер заказа');
    expect(support.text).not.toBe(help.text);
    expect(prices.text).toContain('Yakuniy summa');
    expect(prices.reply_markup.inline_keyboard[0]?.[0]?.text).toBe("Narxlarni ko'rish");
  });

  it('links both legal pages with Russian labels for Russian users', () => {
    const reply = storefrontReply('/terms', 'ru', undefined, config);
    expect(reply.text).toContain('Условия и конфиденциальность');
    expect(reply.reply_markup.inline_keyboard[1]).toEqual([
      { text: 'Условия', url: 'https://donate.example/webapp/terms.html' },
      { text: 'Конфиденциальность', url: 'https://donate.example/webapp/privacy.html' },
    ]);
  });

  it('keeps support usable without a configured storefront URL', () => {
    const reply = storefrontReply('/start', undefined, undefined, { supportUrl: config.supportUrl });
    expect(reply.photo).toBeUndefined();
    expect(reply.reply_markup.inline_keyboard).toEqual([[{
      text: 'Yordam xizmatiga yozish', url: config.supportUrl,
    }]]);
  });

  it('keeps menu commands aligned with handled routes and Telegram text limits', () => {
    for (const locale of ['uz', 'ru', 'en'] as const) {
      const commands = storeBotCommands(locale);
      expect(commands.map((item) => item.command)).toEqual(['start', 'shop', 'prices', 'help', 'paysupport', 'terms']);
      expect(commands.every((item) => isStorefrontCommand(`/${item.command}`) && item.description.length <= 256)).toBe(true);
      expect(STORE_BOT_DESCRIPTIONS[locale].description.length).toBeLessThanOrEqual(512);
      expect(STORE_BOT_DESCRIPTIONS[locale].shortDescription.length).toBeLessThanOrEqual(120);
    }
    expect(isStorefrontCommand('/unknown')).toBe(false);
  });

  it('sends the welcome card without a second text message when the photo succeeds', async () => {
    await sendStorefrontCommand(123, '/start', 'uz', 'Ali', config);
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock).toHaveBeenCalledWith('sendPhoto', expect.objectContaining({
      chat_id: 123, photo: 'https://donate.example/webapp/assets-store/brand-bot-card.png', parse_mode: 'HTML',
    }));
  });

  it('falls back to the same welcome and keyboard when Telegram cannot retrieve the photo', async () => {
    apiMock.mockRejectedValueOnce(new TelegramApiError('Bad Request: failed to get HTTP URL content'));
    await sendStorefrontCommand(123, '/start', 'ru', 'Ali', config);
    expect(apiMock.mock.calls.map(([method]) => method)).toEqual(['sendPhoto', 'sendMessage']);
    expect(apiMock.mock.calls[1]?.[1]).toMatchObject({
      text: storefrontReply('/start', 'ru', 'Ali', config).text,
      reply_markup: storefrontReply('/start', 'ru', 'Ali', config).reply_markup,
    });
  });

  it('surfaces bot authorization errors without trying to send a second message', async () => {
    apiMock.mockRejectedValueOnce(new TelegramApiError('Unauthorized'));
    await expect(sendStorefrontCommand(123, '/start', 'uz', 'Ali', config)).rejects.toThrow('Unauthorized');
    expect(apiMock).toHaveBeenCalledTimes(1);
  });
});
