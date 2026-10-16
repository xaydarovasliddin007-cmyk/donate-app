import type { PrismaClient, TelegramTopUpReview } from '@prisma/client';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { formatMinorAmount } from '../../lib/money.js';
import { logger } from '../../lib/logger.js';
import { verifyTelegramTopUpReview } from '../topup/topup.service.js';
import { topUpReviewBotApi } from './topup-review-bot.js';

interface Chat { id: number; type: string }
export interface ReviewMessage { message_id?: number; from?: { id: number }; chat: Chat; text?: string; reply_to_message?: { message_id: number } }
export interface ReviewCallback { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: Chat; caption?: string } }
interface Context { prisma: PrismaClient }
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function authorized(chat: Chat, senderId: number | undefined) {
  return chat.type === 'private' && Boolean(env.TOPUP_REVIEW_CHAT_ID) && String(chat.id) === env.TOPUP_REVIEW_CHAT_ID && String(senderId) === env.TOPUP_REVIEW_CHAT_ID;
}

export function parseReviewAmount(text: string): number | null {
  const compact = text.replace(/\s/g, '');
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(compact)) return null;
  const [whole, fraction = ''] = compact.replace(',', '.').split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 2_000_000_000 ? minor : null;
}

async function answer(callback: ReviewCallback, text: string, alert = false) {
  await topUpReviewBotApi('answerCallbackQuery', { callback_query_id: callback.id, text, show_alert: alert }).catch(() => undefined);
}

async function prompt(ctx: Context, draft: TelegramTopUpReview, text: string) {
  const sent = await topUpReviewBotApi<{ message_id: number }>('sendMessage', {
    chat_id: draft.chatId, text, parse_mode: 'HTML', reply_markup: { force_reply: true, selective: true },
  });
  await ctx.prisma.telegramTopUpReview.updateMany({ where: { id: draft.id, state: draft.state }, data: { promptMessageId: sent.message_id } });
}

async function confirmation(ctx: Context, draft: TelegramTopUpReview) {
  const request = await ctx.prisma.topUpRequest.findUniqueOrThrow({ where: { id: draft.topUpRequestId } });
  const sent = await topUpReviewBotApi<{ message_id: number }>('sendMessage', {
    chat_id: draft.chatId, parse_mode: 'HTML',
    text: `Summani tasdiqlang\n\nSo‘rov: <code>${request.id}</code>\nSo‘ralgan summa: ${formatMinorAmount(request.amountMinor, request.currency)}\nBalansga qo‘shiladi: <b>${formatMinorAmount(draft.amountMinor!, request.currency)}</b>\nSabab: ${escapeHtml(draft.reviewNote!)}\n\nHaqiqiy to‘lovni tekshirgach tasdiqlang.`,
    reply_markup: { inline_keyboard: [[
      { text: `✅ ${formatMinorAmount(draft.amountMinor!, request.currency)} qo‘shish`, callback_data: `topup:confirm:${draft.id}` },
      { text: 'Bekor qilish', callback_data: `topup:cancel:${draft.id}` },
    ]] },
  });
  await ctx.prisma.telegramTopUpReview.updateMany({ where: { id: draft.id, state: 'READY' }, data: { confirmationMessageId: sent.message_id } });
}

export async function handleTopUpReviewReply(ctx: Context, message: ReviewMessage): Promise<boolean> {
  if (!authorized(message.chat, message.from?.id) || !message.reply_to_message || !message.text) return false;
  const draft = await ctx.prisma.telegramTopUpReview.findFirst({
    where: { chatId: String(message.chat.id), promptMessageId: message.reply_to_message.message_id, state: { in: ['AMOUNT', 'REASON'] } },
  });
  if (!draft) return false;
  if (draft.expiresAt <= new Date()) {
    await topUpReviewBotApi('sendMessage', { chat_id: draft.chatId, text: 'So‘rov muddati tugadi. Chekdagi “Boshqa summa” tugmasini qayta bosing.' });
    return true;
  }
  const amount = draft.state === 'AMOUNT' ? parseReviewAmount(message.text) : draft.amountMinor;
  const note = message.text.trim();
  if (draft.state === 'AMOUNT' && amount === null) {
    await prompt(ctx, draft, 'Summani faqat raqam bilan kiriting. Masalan: <b>48000</b> yoki <b>48 000,50</b>. Summa 0 dan katta, 20 000 000 so‘mgacha bo‘lishi kerak.');
    return true;
  }
  if (draft.state === 'REASON' && (!note || note.length > 500)) {
    await prompt(ctx, draft, 'Summa o‘zgarishi sababini 1–500 belgi bilan yozing.');
    return true;
  }
  const advanced = await ctx.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM telegram_top_up_reviews WHERE id = ${draft.id}::uuid FOR UPDATE`;
    const current = await tx.telegramTopUpReview.findUniqueOrThrow({ where: { id: draft.id } });
    if (current.state !== draft.state || current.promptMessageId !== message.reply_to_message!.message_id || current.expiresAt <= new Date()) return null;
    return tx.telegramTopUpReview.update({ where: { id: draft.id }, data: draft.state === 'AMOUNT'
      ? { amountMinor: amount!, state: 'REASON', promptMessageId: null }
      : { reviewNote: note, state: 'READY', promptMessageId: null } });
  });
  if (!advanced) return true;
  if (advanced.state === 'REASON') await prompt(ctx, advanced, `Summa: <b>${formatMinorAmount(advanced.amountMinor!, 'UZS')}</b>\n\nSumma o‘zgarishi sababini yozing. Masalan: “Chekdagi haqiqiy tushgan summa”.`);
  else await confirmation(ctx, advanced);
  return true;
}

export async function handleTopUpReviewCallback(ctx: Context, callback: ReviewCallback): Promise<boolean> {
  const match = callback.data?.match(/^topup:(amount|confirm|cancel):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (!match) return false;
  const message = callback.message;
  if (!message || !authorized(message.chat, callback.from.id)) return true;
  const action = match[1]!;
  const id = match[2]!;
  try {
    if (action === 'amount') {
      const request = await ctx.prisma.topUpRequest.findUnique({ where: { id } });
      if (!request || (request.channel !== 'BANKOMAT' && request.type !== 'PAYNET_TERMINAL')) throw new NotFoundError('Bankomat request not found');
      if (request.status !== 'PENDING' && request.status !== 'EXPIRED') throw new ConflictError('Request already reviewed');
      const existing = await ctx.prisma.telegramTopUpReview.findUnique({ where: { triggerCallbackId: callback.id } });
      if (existing) { await answer(callback, 'Summa so‘roviga javob bering.'); return true; }
      const draft = await ctx.prisma.telegramTopUpReview.create({ data: {
        topUpRequestId: request.id, chatId: String(message.chat.id), receiptMessageId: message.message_id,
        triggerCallbackId: callback.id, expiresAt: new Date(Date.now() + 15 * 60_000),
      } });
      await prompt(ctx, draft, `Boshqa summa\n\nSo‘rov: <code>${request.id}</code>\nSo‘ralgan summa: ${formatMinorAmount(request.amountMinor, request.currency)}\n\nHaqiqiy tushgan summani so‘mda kiriting. Masalan: <b>48000</b> yoki <b>48 000,50</b>.\nUshbu xabarga javob bering. So‘rov 15 daqiqa amal qiladi.`);
      await answer(callback, 'Haqiqiy tushgan summani yozing.');
      return true;
    }
    const draft = await ctx.prisma.telegramTopUpReview.findUnique({ where: { id } });
    if (!draft || draft.chatId !== String(message.chat.id) || draft.confirmationMessageId !== message.message_id || draft.state !== 'READY' || draft.expiresAt <= new Date()) throw new ConflictError('Review expired or already used');
    if (action === 'cancel') {
      const cancelled = await ctx.prisma.telegramTopUpReview.updateMany({ where: { id, state: 'READY' }, data: { state: 'CANCELLED' } });
      if (cancelled.count !== 1) throw new ConflictError('Review already used');
      await answer(callback, 'Summa o‘zgartirish bekor qilindi.');
      await topUpReviewBotApi('editMessageText', { chat_id: draft.chatId, message_id: message.message_id, text: 'Summa o‘zgartirish bekor qilindi.', reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
      return true;
    }
    const reviewed = await verifyTelegramTopUpReview(ctx, draft.topUpRequestId, { id, chatId: draft.chatId, confirmationMessageId: message.message_id });
    await answer(callback, 'To‘lov tasdiqlandi.');
    // A delivery/edit failure after the transaction cannot undo or retry credit.
    await topUpReviewBotApi('editMessageText', { chat_id: draft.chatId, message_id: message.message_id,
      text: `✅ ${formatMinorAmount(reviewed.amountMinor, reviewed.currency)} balansga qo‘shildi.`, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
    await topUpReviewBotApi('editMessageCaption', { chat_id: draft.chatId, message_id: draft.receiptMessageId,
      caption: `🧾 Bankomat cheki\nSo‘rov: ${reviewed.id}\n✅ ${formatMinorAmount(reviewed.amountMinor, reviewed.currency)} balansga qo‘shildi.\nSabab: ${draft.reviewNote}`, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  } catch (error) {
    const expected = error instanceof ConflictError || error instanceof NotFoundError;
    if (!expected) logger.error({ reviewId: id }, 'Telegram amount review failed');
    await answer(callback, expected ? 'So‘rov eskirgan yoki avval ko‘rib chiqilgan. Chekni qayta oching.' : 'Amal bajarilmadi. Qayta urinib ko‘ring yoki admin paneldan tekshiring.', true);
  }
  return true;
}
