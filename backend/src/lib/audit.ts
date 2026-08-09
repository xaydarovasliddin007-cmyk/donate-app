import type { Prisma, PrismaClient } from '@prisma/client';

interface WriteAuditLogParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/** Records a sensitive admin action. Never skip this for writes that touch money, access, or content visible to customers. */
export function writeAuditLog(prisma: PrismaClient, params: WriteAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      actorType: 'ADMIN',
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
