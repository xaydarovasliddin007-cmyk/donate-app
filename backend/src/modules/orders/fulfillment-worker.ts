import type { PrismaClient } from '@prisma/client';
import { getTopupProvider } from '../../providers/registry.js';
import { createNotification } from '../notifications/notifications.service.js';
import { notifyAdmins } from '../../lib/telegram.js';

/** Polls accepted orders; it never submits a new purchase or changes a wallet. */
export async function reconcileFulfillment(prisma: PrismaClient) {
  const attempts = await prisma.providerAttempt.findMany({
    where: { status: 'PENDING', providerTransactionId: { not: null }, order: { status: 'PROCESSING' } },
    include: { order: true, provider: true }, orderBy: { createdAt: 'asc' }, take: 50,
  });
  for (const attempt of attempts) {
    try {
      const result = await getTopupProvider(attempt.provider.code).getTopupStatus(attempt.providerTransactionId!, {
        referenceId: attempt.orderId, providerProductCode: attempt.providerProductCode,
        playerId: attempt.order.playerId, serverId: attempt.order.zoneId ?? undefined,
        gameServerCode: attempt.order.serverId ?? undefined,
      });
      if (result.status === 'PENDING') continue;
      const success = result.status === 'SUCCESS';
      const status = success ? 'COMPLETED' : 'FAILED';
      const reason = success ? 'Delivery confirmed by provider' : 'Provider confirmed delivery failure';
      const changed = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({ where: { id: attempt.orderId, status: 'PROCESSING' }, data: {
          status, completedAt: success ? new Date() : null, failureReason: success ? null : reason,
        } });
        if (!claimed.count) return false;
        await tx.providerAttempt.update({ where: { id: attempt.id }, data: { status: result.status, completedAt: new Date() } });
        await tx.orderStatusHistory.create({ data: { orderId: attempt.orderId, fromStatus: 'PROCESSING', toStatus: status, reason } });
        return true;
      });
      if (!changed) continue;
      await createNotification({ prisma }, { userId: attempt.order.userId, type: success ? 'ORDER_SUCCESS' : 'ORDER_FAILED',
        title: success ? 'Top-up completed' : 'Order failed', body: `Order #${attempt.order.orderNumber}: ${reason}.`, deepLink: `/orders/${attempt.orderId}` });
      notifyAdmins(`Order #${attempt.order.orderNumber}: ${reason}`);
    } catch {
      // A timeout cannot establish that delivery failed. Keep the order pending.
    }
  }
}
