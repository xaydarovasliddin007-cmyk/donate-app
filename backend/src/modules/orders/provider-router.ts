import type { Prisma, PrismaClient } from '@prisma/client';
import { getTopupProvider } from '../../providers/registry.js';

export type FulfillmentCandidate = Prisma.ProviderProductGetPayload<{
  include: { provider: true };
}>;

/**
 * Returns usable suppliers in economic order. ProviderProduct.costMinor is
 * already normalized to the product currency, so unlike raw supplier quotes
 * it is safe to compare directly. Unknown prices remain available as the
 * final fallback, ordered by the manually controlled priority.
 */
export async function listFulfillmentCandidates(
  prisma: PrismaClient,
  productId: string,
  excludeProviderIds: string[] = [],
): Promise<FulfillmentCandidate[]> {
  const mappings = await prisma.providerProduct.findMany({
    where: {
      productId,
      isActive: true,
      ...(excludeProviderIds.length ? { providerId: { notIn: excludeProviderIds } } : {}),
      provider: {
        isActive: true,
        type: 'TOPUP',
        healthStatus: { not: 'DOWN' },
      },
    },
    orderBy: [
      { costMinor: { sort: 'asc', nulls: 'last' } },
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
    include: { provider: true },
  });

  return mappings.filter((mapping) => {
    try {
      getTopupProvider(mapping.provider.code);
      return true;
    } catch {
      // A DB mapping without credentials is not an active route.
      return false;
    }
  });
}
