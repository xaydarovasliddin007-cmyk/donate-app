import type { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';

interface NotificationContext {
  prisma: PrismaClient;
}

/**
 * Real, DB-backed in-app notifications — every event listed below actually
 * creates a row, so the notification center is genuine even before Firebase
 * Cloud Messaging (real push delivery) is wired up. See README for what FCM
 * setup is still needed to also push these to the device.
 */
export async function createNotification(
  ctx: NotificationContext,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    deepLink?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      deepLink: params.deepLink,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listNotifications(ctx: NotificationContext, userId: string, limit: number) {
  const [notifications, unreadCount] = await Promise.all([
    ctx.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    ctx.prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications, unreadCount };
}

export async function markAsRead(ctx: NotificationContext, userId: string, notificationId: string) {
  const notification = await ctx.prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  if (notification.userId !== userId) {
    throw new ForbiddenError('This notification does not belong to you');
  }
  if (!notification.readAt) {
    await ctx.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  }
}

export async function markAllAsRead(ctx: NotificationContext, userId: string) {
  await ctx.prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
