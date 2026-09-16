import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startCardTransactionListener } from './lib/card-transaction-listener.js';
import { reconcileFulfillment } from './modules/orders/fulfillment-worker.js';

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  const stopCardListener = await startCardTransactionListener(app.log).catch((err) => {
    app.log.error({ err }, 'Card transaction listener failed to start');
    return async () => {};
  });
  let reconciliation: Promise<void> | undefined;
  const reconcile = () => {
    reconciliation ??= reconcileFulfillment(app.prisma)
      .catch((err) => app.log.error({ err }, 'Fulfillment status check failed'))
      .finally(() => { reconciliation = undefined; });
  };
  const timer = setInterval(reconcile, 30_000);
  timer.unref();
  reconcile();

  closeWithGrace({ delay: 5000 }, async ({ err }) => {
    clearInterval(timer);
    await reconciliation;
    await stopCardListener();
    if (err) {
      app.log.error({ err }, 'Shutting down due to error');
    } else {
      app.log.info('Shutting down gracefully');
    }
    await app.close();
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
