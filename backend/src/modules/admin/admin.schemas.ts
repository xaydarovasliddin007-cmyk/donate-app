import { z } from 'zod';

const orderStatusValues = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;

const topUpStatusValues = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;

export const adminListOrdersQuerySchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  gameId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const adminSearchUsersQuerySchema = z.object({
  // Matches against public ID, email, phone, or display name.
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminListProductsQuerySchema = z.object({
  gameId: z.string().uuid().optional(),
});

export const adminUpdateProductSchema = z
  .object({
    isActive: z.boolean().optional(),
    amountMinor: z.number().int().positive().optional(),
    starsPrice: z.number().int().min(1).max(100000).nullable().optional(),
    // Nullable (not just optional) so the same field can explicitly clear a
    // previously-set cost back to "unknown" — e.g. the supplier price
    // changed and nobody's confirmed the new one yet — without that silently
    // reading as "free."  omitted = leave whatever's there alone.
    costMinor: z.number().int().nonnegative().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one product field must be provided',
  });

const gameAvailabilityValues = ['ACTIVE', 'COMING_SOON', 'DISABLED'] as const;

export const adminListGamesQuerySchema = z.object({
  includeDisabled: z.coerce.boolean().default(true),
});

export const adminCreateGameSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens only'),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60).optional(),
  logoEmoji: z.string().trim().min(1).max(8).optional(),
  logoUrl: z.string().trim().url().max(500).optional(),
  availability: z.enum(gameAvailabilityValues).default('COMING_SOON'),
  sortOrder: z.number().int().optional(),
});

export const adminUpdateGameSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    logoEmoji: z.string().trim().min(1).max(8).optional(),
    logoUrl: z.string().trim().url().max(500).optional(),
    availability: z.enum(gameAvailabilityValues).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const adminCreateGameServerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'code must be letters, numbers, underscores, and hyphens only'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

export const adminUpdateGameServerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const adminCreateProductSchema = z.object({
  gameId: z.string().uuid(),
  serverId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  amountMinor: z.number().int().positive(),
  starsPrice: z.number().int().min(1).max(100000).optional(),
  // What this actually costs you (the supplier/provider price), separate
  // from amountMinor (what the customer pays) — powers the profit stats on
  // the dashboard. Optional: left unset, this product's sales are simply
  // excluded from the profit total rather than assumed free.
  costMinor: z.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default('UZS'),
  isActive: z.boolean().default(true),
  isTest: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

export const adminUpdateProviderSchema = z.object({
  isActive: z.boolean(),
});

export const adminCreateProviderProductSchema = z.object({
  providerId: z.string().uuid(),
  // The provider's own SKU/code for this exact product (e.g. Apigames'
  // `kode_produk`) — opaque to us, comes from the provider's catalog.
  providerProductCode: z.string().trim().min(1).max(120),
  // Lower priority is tried first, so a real provider can be added at 0
  // ahead of the dev mock without deleting the mock mapping.
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const adminUpdateProviderProductSchema = z
  .object({
    providerProductCode: z.string().trim().min(1).max(120).optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const adminListTopUpsQuerySchema = z.object({
  status: z.enum(topUpStatusValues).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminRejectTopUpSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(500),
});

export const adminCreatePromoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens, and underscores'),
  bonusAmountMinor: z.number().int().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const adminUpdatePromoCodeSchema = z.object({
  isActive: z.boolean().optional(),
});

export const adminCreateReceivingMethodSchema = z
  .object({
    type: z.enum(['CARD_TRANSFER', 'QR_CODE', 'PAYNET_TERMINAL']).default('CARD_TRANSFER'),
    cardNumber: z.string().trim().min(4).max(40).optional(),
    cardHolderName: z.string().trim().min(1).max(120),
    bankName: z.string().trim().min(1).max(120).optional(),
    qrPayload: z.string().trim().min(10).max(600).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((data) => data.type !== 'CARD_TRANSFER' || !!data.cardNumber, {
    message: 'cardNumber is required for CARD_TRANSFER',
    path: ['cardNumber'],
  })
  .refine((data) => data.type === 'CARD_TRANSFER' || !!data.qrPayload, {
    message: 'qrPayload is required for QR_CODE and PAYNET_TERMINAL',
    path: ['qrPayload'],
  });

export const adminUpdateReceivingMethodSchema = z
  .object({
    isActive: z.boolean().optional(),
    cardNumber: z.string().trim().min(4).max(40).optional(),
    cardHolderName: z.string().trim().min(1).max(120).optional(),
    bankName: z.string().trim().min(1).max(120).optional(),
    qrPayload: z.string().trim().min(10).max(600).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const adminWalletAdjustSchema = z.object({
  direction: z.enum(['CREDIT', 'DEBIT']),
  amountMinor: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const adminUpdateUserDiscountSchema = z.object({
  discountPercent: z.number().int().min(0).max(100),
});

export const adminRefundOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

const adminRoleValues = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'FINANCE', 'CONTENT_MANAGER'] as const;

export const adminCreateAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(adminRoleValues),
});

export const adminUpdateAdminSchema = z
  .object({
    isActive: z.boolean().optional(),
    role: z.enum(adminRoleValues).optional(),
  })
  .refine((data) => data.isActive !== undefined || data.role !== undefined, {
    message: 'At least one of isActive or role must be provided',
  });

export const adminListAuditLogsQuerySchema = z.object({
  entityType: z.string().trim().min(1).max(60).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const adminStatsQuerySchema = z
  .object({
    range: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((data) => data.range !== 'custom' || (data.from !== undefined && data.to !== undefined), {
    message: 'from and to are required when range=custom',
  });

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminSearchUsersQuery = z.infer<typeof adminSearchUsersQuerySchema>;
export type AdminListProductsQuery = z.infer<typeof adminListProductsQuerySchema>;
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;
export type AdminListTopUpsQuery = z.infer<typeof adminListTopUpsQuerySchema>;
export type AdminRejectTopUpInput = z.infer<typeof adminRejectTopUpSchema>;
export type AdminCreatePromoCodeInput = z.infer<typeof adminCreatePromoCodeSchema>;
export type AdminUpdatePromoCodeInput = z.infer<typeof adminUpdatePromoCodeSchema>;
export type AdminCreateReceivingMethodInput = z.infer<typeof adminCreateReceivingMethodSchema>;
export type AdminUpdateReceivingMethodInput = z.infer<typeof adminUpdateReceivingMethodSchema>;
export type AdminWalletAdjustInput = z.infer<typeof adminWalletAdjustSchema>;
export type AdminUpdateUserDiscountInput = z.infer<typeof adminUpdateUserDiscountSchema>;
export type AdminRefundOrderInput = z.infer<typeof adminRefundOrderSchema>;
export type AdminStatsQuery = z.infer<typeof adminStatsQuerySchema>;
export type AdminCreateAdminInput = z.infer<typeof adminCreateAdminSchema>;
export type AdminUpdateAdminInput = z.infer<typeof adminUpdateAdminSchema>;
export type AdminListAuditLogsQuery = z.infer<typeof adminListAuditLogsQuerySchema>;
export type AdminListGamesQuery = z.infer<typeof adminListGamesQuerySchema>;
export type AdminCreateGameInput = z.infer<typeof adminCreateGameSchema>;
export type AdminUpdateGameInput = z.infer<typeof adminUpdateGameSchema>;
export type AdminCreateGameServerInput = z.infer<typeof adminCreateGameServerSchema>;
export type AdminUpdateGameServerInput = z.infer<typeof adminUpdateGameServerSchema>;
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;
export type AdminUpdateProviderInput = z.infer<typeof adminUpdateProviderSchema>;
export type AdminCreateProviderProductInput = z.infer<typeof adminCreateProviderProductSchema>;
export type AdminUpdateProviderProductInput = z.infer<typeof adminUpdateProviderProductSchema>;
