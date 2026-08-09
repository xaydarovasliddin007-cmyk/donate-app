import type { OrderStatus } from '@prisma/client';

/**
 * The only place order status transitions are allowed to be defined. Nothing
 * else in the codebase should do `prisma.order.update({ data: { status } })`
 * without going through {@link assertTransition} first.
 *
 * FAILED -> PROCESSING exists solely for the admin "retry fulfillment"
 * action (backend/src/modules/admin/admin.service.ts) — it is never reachable
 * from a customer-facing route.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED', 'FAILED'],
  PAID: ['PROCESSING', 'FAILED', 'REFUNDED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: ['REFUNDED'],
  FAILED: ['PROCESSING'],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
}
