import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // Liveness: process is up. Must never touch the database — used by the
  // orchestrator to decide whether to restart the container.
  app.get('/health', async () => {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  });

  // Readiness: process can actually serve traffic (DB reachable).
  // Used by load balancers to decide whether to route traffic here.
  app.get('/ready', async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (err) {
      app.log.error({ err }, 'Readiness check failed: database unreachable');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });
}
