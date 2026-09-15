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
import { telegramApi } from './telegram-api.js';
import { checkStarsCheckout, createStarsInvoice, settleStarsPayment } from './telegram-payments.js';

const authSchema = z.object({ initData: z.string().min(1).max(16384) });
const telegramUser = z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
const paymentSchema = z.object({ currency: z.string(), total_amount: z.number().int().positive(), invoice_payload: z.string().uuid() });
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
        const support = ['/help', '/paysupport'].includes(command);
        const text = support
          ? "To'lov yoki buyurtma bo'yicha yordam: buyurtma raqamingiz bilan operatorga murojaat qiling."
          : "UZDONATE\n\nO'yinlar, paketlar va amaldagi narxlar do'konda. Buyurtmalaringizni shu yerdan kuzatishingiz mumkin.";
        const rows: Record<string, unknown>[][] = [];
        if (env.PUBLIC_APP_URL) rows.push([{ text: "Do'konni ochish", web_app: { url: new URL('/webapp/', env.PUBLIC_APP_URL).href } }]);
        if (command === '/terms' && env.PUBLIC_APP_URL) rows.push([{ text: 'Xizmat shartlari', url: new URL('/webapp/terms.html', env.PUBLIC_APP_URL).href }]);
        rows.push([{ text: 'Yordam', url: env.SUPPORT_TELEGRAM_URL }]);
        await telegramApi('sendMessage', { chat_id: message.chat.id, text, reply_markup: { inline_keyboard: rows } });
      }
    }
    return { ok: true };
  });
}
