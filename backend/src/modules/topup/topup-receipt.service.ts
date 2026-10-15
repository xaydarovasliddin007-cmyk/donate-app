import type { PrismaClient } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { formatMinorAmount } from '../../lib/money.js';
import { sendTopUpReceiptPhoto } from '../../lib/telegram.js';
import type { SubmitTopUpReceiptInput } from './topup.schemas.js';

interface Context { prisma: PrismaClient }
export const receiptSummarySelect = { fileName: true, mimeType: true, createdAt: true, deliveryStatus: true, telegramMessageId: true } as const;

function decodeImage(input: SubmitTopUpReceiptInput) {
  const image = Buffer.from(input.dataBase64, 'base64');
  if (!image.length || image.length > 5 * 1024 * 1024) throw new ValidationError('Receipt image must be 5 MB or smaller');
  const valid = input.mimeType === 'image/jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : input.mimeType === 'image/png'
      ? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : image.subarray(0, 4).toString('ascii') === 'RIFF' && image.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) throw new ValidationError('Receipt file is not a valid image');
  return image;
}

export async function submitTopUpReceipt(ctx: Context, userId: string, topUpRequestId: string, input: SubmitTopUpReceiptInput) {
  const saved = await ctx.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM top_up_requests WHERE id = ${topUpRequestId}::uuid FOR UPDATE`;
    const request = await tx.topUpRequest.findUnique({ where: { id: topUpRequestId }, include: { user: { select: { publicId: true, displayName: true } } } });
    if (!request) throw new NotFoundError('Top-up request not found');
    if (request.userId !== userId) throw new ForbiddenError('This top-up request does not belong to you');
    if (request.channel !== 'BANKOMAT' && request.type !== 'PAYNET_TERMINAL') throw new ValidationError('Receipt screenshots are accepted only for Bankomat payments');
    if (request.status !== 'PENDING' && request.status !== 'EXPIRED') throw new ConflictError('Only open Bankomat requests accept receipts');
    const existing = await tx.topUpReceipt.findUnique({ where: { topUpRequestId }, select: receiptSummarySelect });
    if (existing) return { request, created: false, image: undefined };
    const image = decodeImage(input);
    const fileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'receipt.jpg';
    const legacyMessage = request.userReference?.match(/^Telegram chek #(\d+)$/)?.[1];
    await tx.topUpReceipt.create({ data: { topUpRequestId, fileName, mimeType: input.mimeType, imageData: image,
      deliveryStatus: legacyMessage ? 'SENT' : 'PENDING', telegramMessageId: legacyMessage ? Number(legacyMessage) : undefined } });
    await tx.topUpRequest.update({ where: { id: topUpRequestId }, data: { userConfirmedPaidAt: request.userConfirmedPaidAt ?? new Date(), userReference: legacyMessage ? request.userReference : `Chek: ${fileName}` } });
    return { request, created: !legacyMessage, image };
  });
  // The administrator already has durable proof in the panel. A Telegram outage
  // must not discard the image or make a successful upload appear unsuccessful.
  if (saved.created && saved.image) {
    try {
      const messageId = await sendTopUpReceiptPhoto({ image: saved.image, mimeType: input.mimeType, fileName: input.fileName,
        requestId: topUpRequestId, userLabel: saved.request.user.displayName || saved.request.user.publicId,
        amount: formatMinorAmount(saved.request.amountMinor, saved.request.currency) });
      await ctx.prisma.$transaction([
        ctx.prisma.topUpReceipt.update({ where: { topUpRequestId }, data: { deliveryStatus: 'SENT', telegramMessageId: messageId, deliveredAt: new Date() } }),
        ctx.prisma.topUpRequest.update({ where: { id: topUpRequestId }, data: { userReference: `Telegram chek #${messageId}` } }),
      ]);
    } catch {
      await ctx.prisma.topUpReceipt.update({ where: { topUpRequestId }, data: { deliveryStatus: 'FAILED' } });
      logger.warn({ topUpRequestId }, 'Receipt saved in admin panel; Telegram delivery unavailable');
    }
  }
  return ctx.prisma.topUpRequest.findUniqueOrThrow({ where: { id: topUpRequestId }, include: { receivingMethod: true, receipt: { select: receiptSummarySelect } } });
}

export async function getTopUpReceipt(ctx: Context, topUpRequestId: string, customerId?: string) {
  const request = await ctx.prisma.topUpRequest.findUnique({ where: { id: topUpRequestId }, select: { userId: true } });
  if (!request) throw new NotFoundError('Top-up request not found');
  if (customerId && request.userId !== customerId) throw new ForbiddenError('This top-up request does not belong to you');
  const receipt = await ctx.prisma.topUpReceipt.findUnique({ where: { topUpRequestId } });
  if (!receipt) throw new NotFoundError('Receipt image not found');
  return receipt;
}
