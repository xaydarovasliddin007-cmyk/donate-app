/**
 * Telegram userbot that watches @HUMOcardbot's own DM notifications and
 * forwards each parsed card-transfer transaction to the backend, so
 * card-transfer top-ups (see modules/topup/topup.service.ts) can be
 * verified automatically instead of waiting on an admin.
 *
 * This is deliberately NOT a Bot-API bot: a bot account cannot read
 * another bot's DMs sent to a *user* account. It logs in as a real
 * Telegram user — the same account that is registered with
 * @HUMOcardbot and already receives its notifications — using GramJS
 * (npm package `telegram`).
 *
 * Run with: npx tsx scripts/humo-listener.ts
 *
 * First run only: TELEGRAM_SESSION is empty, so GramJS prompts
 * interactively in this terminal for the phone number, the login code
 * Telegram texts to that phone, and the 2FA password if one is set.
 * This step has to be done in person by whoever owns the Telegram
 * account — there is no way to script or delegate it. Once logged in,
 * the script prints a session string; save it as TELEGRAM_SESSION in
 * backend/.env so every later run is unattended.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js';
import { parseHumoMessage } from '../src/lib/humo-message-parser.js';

const apiId = Number(process.env.TELEGRAM_API_ID ?? '');
const apiHash = process.env.TELEGRAM_API_HASH ?? '';
const sessionString = process.env.TELEGRAM_SESSION ?? '';
const webhookUrl = process.env.HUMO_WEBHOOK_URL ?? 'http://localhost:4000/api/v1/payments/webhooks/humo-transaction';
const webhookSecret = process.env.HUMO_WEBHOOK_SECRET ?? '';
const botUsername = process.env.HUMO_BOT_USERNAME ?? 'HUMOcardbot';

if (!apiId || !apiHash) {
  console.error(
    'TELEGRAM_API_ID and TELEGRAM_API_HASH are required. Get them from https://my.telegram.org ' +
      '("API development tools"), then set both in backend/.env.',
  );
  process.exit(1);
}
if (!webhookSecret) {
  console.error('HUMO_WEBHOOK_SECRET is required — set it in backend/.env (same value the backend uses).');
  process.exit(1);
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function forwardTransaction(payload: { transactionId: string; cardHint: string; amountMinor: number; rawMessage: string }) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': webhookSecret },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    console.log(`[humo-listener] forwarded → ${response.status}`, body);
  } catch (error) {
    console.error('[humo-listener] failed to reach webhook', error);
  }
}

async function main() {
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => prompt('Phone number (with country code, e.g. +998...): '),
    password: async () => prompt('2FA password (leave blank if none): '),
    phoneCode: async () => prompt('Login code from Telegram: '),
    onError: (err) => console.error('[humo-listener] login error', err),
  });

  if (!sessionString) {
    console.log('\n[humo-listener] Logged in. Save this as TELEGRAM_SESSION in backend/.env:\n');
    console.log(client.session.save());
    console.log();
  }

  const me = await client.getMe();
  console.log(`[humo-listener] connected as ${me.username ?? me.id}, watching messages from @${botUsername}`);

  client.addEventHandler(async (event: NewMessageEvent) => {
    // This process runs unattended for days/weeks at a time watching every
    // single incoming Telegram message — one bad message (a weird sender
    // object, a getSender() network hiccup) throwing here must never take
    // the whole listener down, or every card-transfer top-up silently
    // reverts to manual-only with nobody watching.
    try {
      const message = event.message;
      const sender = await message.getSender();
      const senderUsername = sender && 'username' in sender ? sender.username : undefined;
      if (!senderUsername || senderUsername.toLowerCase() !== botUsername.toLowerCase()) return;

      const text = message.message ?? '';
      const parsed = parseHumoMessage(text);
      if (!parsed) {
        console.log('[humo-listener] could not parse message, skipping:', text);
        return;
      }

      console.log('[humo-listener] parsed transaction', parsed);
      await forwardTransaction({ transactionId: `${botUsername}:${message.id}`, ...parsed, rawMessage: text });
    } catch (error) {
      console.error('[humo-listener] error handling message, continuing to listen', error);
    }
  }, new NewMessage({}));

  console.log('[humo-listener] listening... (Ctrl+C to stop)');

  // Without this, main() returns once client.start() resolves and Node
  // exits as soon as the last GramJS-internal keepalive timer lets go —
  // under process supervision (see docker-compose's humo-listener service)
  // that means a restart loop instead of a listener that actually stays up.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error('[humo-listener] fatal error', error);
  process.exit(1);
});
