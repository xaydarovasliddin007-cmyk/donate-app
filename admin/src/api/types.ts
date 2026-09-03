export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export type StatsRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface Stats {
  range: { from: string; to: string };
  ordersByStatus: Record<string, number>;
  totalUsers: number;
  usersByStatus: Record<string, number>;
  newUsersInRange: number;
  revenueInRangeByCurrency: Record<string, number>;
  ordersInRange: number;
  walletLiabilityByCurrency: Record<string, number>;
  topUpsByStatus: Record<string, number>;
  topClients: {
    user: {
      id: string;
      publicId: string;
      displayName: string | null;
      email: string | null;
      discountPercent: number;
    } | null;
    totalSpentMinor: number;
    orderCount: number;
  }[];
  topGames: {
    game: { id: string; name: string; slug: string } | null;
    revenueMinor: number;
    orderCount: number;
  }[];
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type TopUpRequestStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type ProviderType = 'PAYMENT' | 'TOPUP';
export type ProviderHealthStatus = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface UserListItem {
  id: string;
  publicId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  locale: string;
  role: string;
  status: string;
  discountPercent: number;
  createdAt: string;
  _count: { orders: number };
}

export interface WalletSummary {
  balanceMinor: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: 'TOPUP' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT' | 'BONUS';
  direction: 'CREDIT' | 'DEBIT';
  amountMinor: number;
  currency: string;
  balanceAfterMinor: number;
  reference: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  userId: string;
  gameId: string;
  playerId: string;
  serverId: string | null;
  amountMinor: number;
  currency: string;
  discountPercent: number;
  status: OrderStatus;
  failureReason: string | null;
  createdAt: string;
  game: { id: string; name: string; slug: string };
  user: { id: string; email: string | null; phone: string | null; displayName: string | null };
  items: OrderItem[];
  payments: Payment[];
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
}

export interface Payment {
  id: string;
  orderId: string;
  providerId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  attempts?: PaymentAttempt[];
}

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  providerRef: string | null;
  status: 'INITIATED' | 'SUCCEEDED' | 'FAILED';
  createdAt: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetail extends Omit<OrderSummary, 'payments'> {
  payments: Payment[];
  providerAttempts: unknown[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface UserDetail {
  user: {
    id: string;
    publicId: string;
    email: string | null;
    phone: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    locale: string;
    role: string;
    status: string;
    discountPercent: number;
    createdAt: string;
  };
  wallet: WalletSummary;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    amountMinor: number;
    currency: string;
    createdAt: string;
    game: { name: string };
  }[];
  recentTransactions: WalletTransaction[];
  activeSessions: { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string }[];
}

export type ReceivingMethodType = 'CARD_TRANSFER' | 'QR_CODE' | 'PAYNET_TERMINAL';

export interface ReceivingMethod {
  id: string;
  type: ReceivingMethodType;
  cardNumber: string | null;
  cardHolderName: string;
  bankName: string | null;
  qrPayload: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface TopUpRequestAdmin {
  id: string;
  userId: string;
  // Null until a matching bank transaction (or a manual admin review)
  // identifies which of the shown cards actually received the transfer —
  // the reservation flow no longer locks the user to one card up front.
  receivingMethodId: string | null;
  // What the user actually asked to pay with. PAYNET_TERMINAL requests
  // show the exact same real card as a CARD_TRANSFER one (cash at a kiosk
  // lands on that card too), so this is the only way to tell "review this
  // against the SMS bot" apart from "review this against the receipt
  // number in userReference" — null only for requests older than this field.
  type: ReceivingMethodType | null;
  amountMinor: number;
  currency: string;
  status: TopUpRequestStatus;
  userReference: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  receivingMethod: ReceivingMethod | null;
  user: { id: string; publicId: string; email: string | null; phone: string | null; displayName: string | null };
}

export type GameAvailability = 'ACTIVE' | 'COMING_SOON' | 'DISABLED';

export interface Game {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logoEmoji: string | null;
  logoUrl: string | null;
  availability: GameAvailability;
  sortOrder: number;
  createdAt: string;
  _count: { products: number; servers: number };
}

export interface GameServer {
  id: string;
  gameId: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  gameId: string;
  serverId: string | null;
  name: string;
  description: string | null;
  amountMinor: number;
  currency: string;
  isActive: boolean;
  isTest: boolean;
  sortOrder: number;
  game: { id: string; name: string; slug: string };
  server: { id: string; name: string } | null;
}

export interface Provider {
  id: string;
  code: string;
  name: string;
  type: ProviderType;
  isActive: boolean;
  healthStatus: ProviderHealthStatus;
  lastCheckedAt: string | null;
  totalAttempts: number;
  succeededAttempts: number;
  failedAttempts: number;
  successRate: number | null;
}

/** Which provider(s) actually fulfill a product, and the provider's own SKU/code for it (opaque to us). */
export interface ProviderProduct {
  id: string;
  providerId: string;
  productId: string;
  providerProductCode: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  provider: { id: string; code: string; name: string; type: ProviderType; isActive: boolean };
}

export interface RefundEntry {
  id: string;
  amountMinor: number;
  currency: string;
  reason: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
  wallet: { user: { id: string; publicId: string; email: string | null; phone: string | null; displayName: string | null } };
  createdByAdmin: { id: string; fullName: string; email: string } | null;
}

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATIONS' | 'SUPPORT' | 'FINANCE' | 'CONTENT_MANAGER';

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorType: 'ADMIN' | 'SYSTEM';
  actorId: string | null;
  actor: { id: string; email: string; fullName: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}
