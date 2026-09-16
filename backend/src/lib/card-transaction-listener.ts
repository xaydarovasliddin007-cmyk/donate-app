import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js';
import { env } from '../config/env.js';
import { parseHumoMessage } from './humo-message-parser.js';

interface ListenerLogger {
  info: (data: unknown, message?: string) => void;
  warn: (data: unknown, message?: string) => void;
  error: (data: unknown, message?: string) => void;
}

export async function startCardTransactionListener(log: ListenerLogger) {
  const secret = env.CARD_TRANSACTION_WEBHOOK_SECRET || env.HUMO_WEBHOOK_SECRET;
  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH || !env.TELEGRAM_SESSION || !secret) {
    log.warn({}, 'Card transaction listener disabled: Telegram session or webhook secret is missing');
    return async () => {};
  }

  const botUsername = env.HUMO_BOT_USERNAME;
  const client = new TelegramClient(
    new StringSession(env.TELEGRAM_SESSION),
    env.TELEGRAM_API_ID,
    env.TELEGRAM_API_HASH,
    { connectionRetries: 5 },
  );
  await client.connect();
  if (!await client.checkAuthorization()) {
    await client.disconnect();
    throw new Error('Telegram session is no longer authorized');
  }

  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      const message = event.message;
      const sender = await message.getSender();
      const senderUsername = sender && 'username' in sender ? sender.username : undefined;
      if (!senderUsername || senderUsername.toLowerCase() !== botUsername.toLowerCase()) return;

      const rawMessage = message.message ?? '';
      const parsed = parseHumoMessage(rawMessage);
      if (!parsed) {
        log.warn({ messageId: message.id }, 'Could not parse card transaction notification');
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:${env.PORT}/api/v1/payments/webhooks/card-transaction`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
          body: JSON.stringify({
            transactionId: `${botUsername}:${message.id}`,
            ...parsed,
            rawMessage,
          }),
        },
      );
      if (!response.ok) {
        log.error({ status: response.status, messageId: message.id }, 'Card transaction webhook failed');
      }
    } catch (err) {
      log.error({ err }, 'Card transaction listener failed to handle a message');
    }
  }, new NewMessage({}));

  const me = await client.getMe();
  log.info({ telegramUserId: String(me.id), botUsername }, 'Card transaction listener connected');
  return async () => { await client.disconnect(); };
}
