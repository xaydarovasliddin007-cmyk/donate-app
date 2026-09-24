import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ConflictError } from '../src/lib/errors.js';
import { updateProviderAdmin } from '../src/modules/admin/admin.service.js';

const prisma = new PrismaClient();
const ctx = { prisma };
const providerId = randomUUID();
const providerCode = `TEST_UNCONFIGURED_${providerId.slice(0, 8)}`;

describe('admin provider readiness', () => {
  afterAll(async () => {
    await prisma.provider.deleteMany({ where: { id: providerId } });
    await prisma.$disconnect();
  });

  it('does not allow activating a top-up provider without a registered adapter', async () => {
    await prisma.provider.create({
      data: {
        id: providerId,
        code: providerCode,
        name: 'Unconfigured test provider',
        type: 'TOPUP',
        isActive: false,
      },
    });

    await expect(updateProviderAdmin(ctx, 'test-admin', providerId, { isActive: true })).rejects.toBeInstanceOf(ConflictError);
    await expect(prisma.provider.findUniqueOrThrow({ where: { id: providerId } })).resolves.toMatchObject({ isActive: false });
  });
});
