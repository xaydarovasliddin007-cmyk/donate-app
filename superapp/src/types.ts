export interface Game {
  id: string; slug: string; name: string; category: string | null;
  logoEmoji: string | null; logoUrl: string | null;
  availability: string; isPurchasable: boolean;
}
export interface Product {
  id: string; name: string; description: string | null;
  amountMinor: number; currency: string; isTest: boolean;
  discountPercent: number; starsPrice: number | null;
}
export interface GameServer { id: string; name: string; code: string }
export interface User {
  id: string; publicId: string; displayName: string | null;
  email: string | null; avatarUrl: string | null; isGuest: boolean;
  hasTelegramAccount: boolean;
}
export interface Session { accessToken: string; refreshToken: string; user: User }
export interface Wallet { balanceMinor: number; currency: string }
export interface Order {
  id: string; orderNumber: string; game: Pick<Game, 'id' | 'name' | 'slug'>;
  items: { productName: string }[]; amountMinor: number; currency: string;
  playerId: string; serverId: string | null; zoneId: string | null;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string; failureReason: string | null;
}
export interface ReceivingMethod {
  id: string; type: 'CARD_TRANSFER' | 'QR_CODE' | 'PAYNET_TERMINAL';
  cardNumber: string | null; cardHolderName: string; bankName: string | null;
  cardNetwork: 'HUMO' | 'UZCARD' | null;
  qrPayload?: string | null; instructions?: string | null; qrImageUrl?: string | null;
}
export interface TopUp {
  id: string; amountMinor: number; currency: string; status: string;
  type?: ReceivingMethod['type']; userReference?: string | null;
  channel?: 'HUMO' | 'UZCARD' | 'BANKOMAT' | null;
  expiresAt: string | null; receivingMethod: ReceivingMethod | null;
  createdAt: string; userConfirmedPaidAt: string | null;
}
export interface TopUpOption {
  id: 'HUMO' | 'UZCARD' | 'BANKOMAT';
  label: string;
  mode: 'AUTO' | 'MANUAL';
  available: boolean;
}
export interface AppConfig { supportUrl: string; telegramBotUrl: string; telegramPaymentsEnabled: boolean; testMode?: boolean }
export interface CheckoutInput { gameId: string; productId: string; playerId: string; serverId?: string; zoneId?: string; idempotencyKey: string }
