import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { validateBody } from '../../lib/validate.js';
import { ForbiddenError, ServiceUnavailableError, ValidationError } from '../../lib/errors.js';
import { authenticate } from '../../middleware/authenticate.js';
import { telegramAuth } from '../auth/auth.service.js';
import { createOrder } from '../orders/orders.service.js';
import { createOrderSchema, type CreateOrderInput } from '../orders/orders.schemas.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import * as topupService from '../topup/topup.service.js';
import { telegramApi, TelegramApiError } from './telegram-api.js';
import { topUpReviewBotApi } from './topup-review-bot.js';
import { checkStarsCheckout, createStarsInvoice, settleStarsPayment } from './telegram-payments.js';

const authSchema = z.object({ initData: z.string().min(1).max(16384) });
const telegramUser = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  first_name: z.string().optional(),
  language_code: z.string().optional(),
});
const paymentSchema = z.object({ currency: z.string(), total_amount: z.number().int().positive(), invoice_payload: z.string().uuid() });
const webAppRelease = process.env.RENDER_GIT_COMMIT?.slice(0, 12) || 'current';

function storefrontUrl(baseUrl: string) {
  const url = new URL('/webapp/', baseUrl);
  url.searchParams.set('v', webAppRelease);
  return url.href;
}

const updateSchema = z.object({
  update_id: z.number().int(),
  pre_checkout_query: paymentSchema.extend({ id: z.string(), from: telegramUser }).optional(),
  message: z.object({
    from: telegramUser.optional(),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    text: z.string().optional(),
    successful_payment: paymentSchema.extend({ telegram_payment_charge_id: z.string().min(1).max(512) }).optional(),
  }).optional(),
});
const topUpReviewUpdateSchema = z.object({
  update_id: z.number().int(),
  callback_query: z.object({
    id: z.string().min(1),
    from: telegramUser,
    data: z.string().optional(),
    message: z.object({
      message_id: z.number().int(),
      chat: z.object({ id: z.number().int(), type: z.string() }),
      caption: z.string().optional(),
    }).optional(),
  }).optional(),
});

function secretMatches(supplied: string | undefined, expected: string | undefined) {
  return Boolean(expected && supplied && Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)));
}

export async function telegramRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma };
  app.get('/app/config', async () => ({
    testMode: env.NODE_ENV !== 'production',
    supportUrl: env.SUPPORT_TELEGRAM_URL,
    telegramBotUrl: 'https://t.me/uzdonate1bot',
    telegramPaymentsEnabled: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.PUBLIC_APP_URL),
  }));
  app.post('/auth/telegram', {
    config: { rateLimit: { max: 15, timeWindow: 60_000 } }, preHandler: validateBody(authSchema),
  }, async (request) => telegramAuth(
    { ...ctx, signAccessToken: app.jwt.sign.bind(app.jwt) },
    (request.body as z.infer<typeof authSchema>).initData,
    { userAgent: request.headers['user-agent'], ipAddress: request.ip },
  ));
  app.post('/telegram/invoices', {
    preHandler: [authenticate, validateBody(createOrderSchema)],
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
  }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.id } });
    if (!user.telegramId) throw new ForbiddenError('Open the store from the Telegram bot');
    if (!env.TELEGRAM_WEBHOOK_SECRET) throw new ServiceUnavailableError('Telegram payments are not configured');
    const order = await createOrder(ctx, user.id, request.body as CreateOrderInput, 'telegram');
    return createStarsInvoice(ctx, user.id, order.id);
  });
  app.post<{ Params: { orderId: string } }>('/telegram/invoices/:orderId', { preHandler: authenticate }, async (request) => {
    const orderId = z.string().uuid().safeParse(request.params.orderId);
    if (!orderId.success) throw new ValidationError('Invalid order ID');
    if (!env.TELEGRAM_WEBHOOK_SECRET) throw new ServiceUnavailableError('Telegram payments are not configured');
    return createStarsInvoice(ctx, request.currentUser!.id, orderId.data);
  });
  app.post('/telegram/webhook', {
    config: { rateLimit: false },
    preHandler: async (request, reply) => {
      const supplied = request.headers['x-telegram-bot-api-secret-token'];
      const expected = env.TELEGRAM_WEBHOOK_SECRET;
      if (!expected || typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Invalid webhook secret' } });
      }
    },
  }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: 'INVALID_UPDATE', message: 'Invalid Telegram update' } });
    const update = parsed.data;
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      try {
        await checkStarsCheckout(ctx, query.from.id, query);
      } catch {
        await telegramApi('answerPreCheckoutQuery', {
          pre_checkout_query_id: query.id, ok: false,
          error_message: "Buyurtma hozir to'lov uchun mavjud emas. Do'konni qayta oching.",
        });
        return { ok: true };
      }
      await telegramApi('answerPreCheckoutQuery', { pre_checkout_query_id: query.id, ok: true });
    }
    const message = update.message;
    if (message?.successful_payment && message.from) {
      await settleStarsPayment(ctx, message.from.id, message.successful_payment);
    } else if (message?.text && message.chat.type === 'private') {
      const command = message.text.split(/[ @]/)[0] ?? '';
      if (['/start', '/shop', '/prices', '/help', '/paysupport', '/terms'].includes(command)) {
        const ru = message.from?.language_code?.startsWith('ru') ?? false;
        const name = (message.from?.first_name ?? '').slice(0, 64)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const support = ['/help', '/paysupport'].includes(command);
        const welcome = ru
          ? `<b>Добро пожаловать в UZDONATE!</b>\n\n${name ? `Привет, ${name}!` : 'Привет!'} Любимые игры начинаются здесь.\n\n<b>Mobile Legends · PUBG Mobile · Free Fire</b>\nАлмазы, UC и игровые пропуски в одном магазине.\n\nВыберите игру и пакет, укажите игровой ID и следите за заказом в приложении.\n\n<b>Готовы к следующей игре?</b> Откройте магазин ниже.`
          : `<b>UZDONATE'ga xush kelibsiz!</b>\n\n${name ? `Salom, ${name}!` : 'Salom!'} Sevimli o'yinlaringiz shu yerdan boshlanadi.\n\n<b>Mobile Legends · PUBG Mobile · Free Fire</b>\nAlmazlar, UC va o'yin passlari bir do'konda.\n\nO'yin va paketni tanlang, o'yin ID'ingizni kiriting va buyurtmangizni ilovada kuzating.\n\n<b>Keyingi o'yinga tayyormisiz?</b> Do'konni quyidagi tugma orqali oching.`;
        const text = command === '/start' ? welcome : support
          ? "To'lov yoki buyurtma bo'yicha yordam: buyurtma raqamingiz bilan operatorga murojaat qiling."
          : "UZDONATE\n\nO'yinlar, paketlar va amaldagi narxlar do'konda. Buyurtmalaringizni shu yerdan kuzatishingiz mumkin.";
        const rows: Record<string, unknown>[][] = [];
        if (env.PUBLIC_APP_URL) rows.push([{ text: ru ? 'Открыть магазин' : "Do'konni ochish", web_app: { url: storefrontUrl(env.PUBLIC_APP_URL) } }]);
        if (command === '/terms' && env.PUBLIC_APP_URL) rows.push([{ text: 'Xizmat shartlari', url: new URL('/webapp/terms.html', env.PUBLIC_APP_URL).href }]);
        rows.push([{ text: ru ? 'Поддержка' : 'Yordam', url: env.SUPPORT_TELEGRAM_URL }]);
        const reply = { chat_id: message.chat.id, parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } };
        if (command === '/start' && env.PUBLIC_APP_URL) {
          try {
            await telegramApi('sendPhoto', {
              ...reply,
              photo: new URL('/webapp/assets-store/brand.png', env.PUBLIC_APP_URL).href,
              caption: text,
            });
            return { ok: true };
          } catch (err) {
            // A failed image download must not prevent the welcome message.
            if (!(err instanceof TelegramApiError) || !/photo|image|file|HTTP URL|WEBPAGE/i.test(err.description)) throw err;
          }
        }
        await telegramApi('sendMessage', { ...reply, text });
      }
    }
    return { ok: true };
  });

  app.post('/telegram/topup-review-webhook', {
    config: { rateLimit: false },
    preHandler: async (request, reply) => {
      const supplied = request.headers['x-telegram-bot-api-secret-token'];
      if (typeof supplied !== 'string' || !secretMatches(supplied, env.TELEGRAM_WEBHOOK_SECRET)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Invalid webhook secret' } });
      }
    },
  }, async (request, reply) => {
    const parsed = topUpReviewUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: 'INVALID_UPDATE', message: 'Invalid Telegram update' } });
    const callback = parsed.data.callback_query;
    if (!callback) return { ok: true };

    const configuredChatId = env.TOPUP_REVIEW_CHAT_ID;
    const message = callback.message;
    if (!configuredChatId || !message || message.chat.type !== 'private' ||
        String(message.chat.id) !== configuredChatId || String(callback.from.id) !== configuredChatId) {
      return { ok: true };
    }

    const action = callback.data?.match(/^topup:(approve|reject):([0-9a-f-]{36})$/i);
    if (!action) {
      await topUpReviewBotApi('answerCallbackQuery', { callback_query_id: callback.id, text: 'Noma’lum amal.' }).catch(() => undefined);
      return { ok: true };
    }

    const decision = action[1];
    const requestId = z.string().uuid().safeParse(action[2]);
    if (!requestId.success) return { ok: true };

    try {
      const topUp = await app.prisma.topUpRequest.findUnique({ where: { id: requestId.data } });
      if (!topUp || (topUp.channel !== 'BANKOMAT' && topUp.type !== 'PAYNET_TERMINAL')) {
        throw new NotFoundError('Bankomat cheki topilmadi');
      }

      const rejected = decision === 'reject';
      const rejectionReason = 'Bankomat cheki tasdiqlanmadi. Iltimos, chekni tekshirib yordam xizmatiga murojaat qiling.';
      if (rejected) {
        await topupService.rejectTopUpRequest({ prisma: app.prisma }, null, requestId.data, rejectionReason);
      } else {
        await topupService.verifyTopUpRequest({ prisma: app.prisma }, null, requestId.data);
      }

      const status = rejected ? '❌ <b>Rad etildi</b>' : '✅ <b>Balansga muvaffaqiyatli qo‘shildi</b>';
      await app.prisma.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          action: rejected ? 'telegram.topup.reject' : 'telegram.topup.verify',
          entityType: 'TopUpRequest',
          entityId: requestId.data,
          metadata: { source: 'telegram_review_bot', telegramId: callback.from.id, chatId: message.chat.id },
        },
      }).catch((err: unknown) => logger.error({ err, topUpRequestId: requestId.data }, 'Telegram top-up action audit write failed'));

      await topUpReviewBotApi('answerCallbackQuery', {
        callback_query_id: callback.id,
        text: rejected ? 'To‘lov rad etildi.' : 'To‘lov tasdiqlandi.',
      }).catch((err: unknown) => logger.warn({ err }, 'Telegram review callback answer failed'));
      await topUpReviewBotApi('editMessageCaption', {
        chat_id: message.chat.id,
        message_id: message.message_id,
        caption: `${message.caption ?? '🧾 <b>Bankomat cheki</b>'}\n\n${status}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      }).catch((err: unknown) => logger.warn({ err, topUpRequestId: requestId.data }, 'Telegram review message update failed'));
    } catch (err) {
      if (err instanceof ConflictError || err instanceof NotFoundError) {
        await topUpReviewBotApi('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: 'Bu chek avval ko‘rib chiqilgan yoki topilmadi.',
          show_alert: true,
        }).catch(() => undefined);
        await topUpReviewBotApi('editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [] },
        }).catch(() => undefined);
      } else {
        logger.error({ err, topUpRequestId: requestId.data }, 'Telegram top-up review action failed');
        await topUpReviewBotApi('answerCallbackQuery', {
          callback_query_id: callback.id,
          text: 'Amal bajarilmadi. Admin paneldan tekshiring.',
          show_alert: true,
        }).catch(() => undefined);
      }
    }
    return { ok: true };
  });
}
