import type { FastifyInstance } from 'fastify';

export async function promotionsRoutes(app: FastifyInstance) {
  app.get('/promotions', async () => {
    const now = new Date();
    const promotions = await app.prisma.promotion.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      promotions: promotions.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        description: p.description,
      })),
    };
  });
}
