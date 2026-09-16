import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startCardTransactionListener } from './lib/card-transaction-listener.js';
import { reconcileFulfillment } from './modules/orders/fulfillment-worker.js';

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  let stopCardListener = async () => {};
  let listenerStart: Promise<void> | undefined;
  const startListener = () => {
    listenerStart = startCardTransactionListener(app.log)
      .then((stop) => { stopCardListener = stop; })
      .catch((err) => { app.log.error({ err }, 'Card transaction listener failed to start'); });
  };
  // Render briefly runs the old and new instances together during a deploy.
  // Opening the same Telegram user session in both invalidates its auth key,
  // so let the old instance shut down before the replacement connects.
  const listenerDelayMs = process.env.RENDER ? 45_000 : 0;
  const listenerTimer = listenerDelayMs > 0 ? setTimeout(startListener, listenerDelayMs) : undefined;
  if (listenerTimer) {
    app.log.info({ delayMs: listenerDelayMs }, 'Card transaction listener scheduled');
  } else {
    startListener();
  }
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
    if (listenerTimer) clearTimeout(listenerTimer);
    await reconciliation;
    await listenerStart;
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
