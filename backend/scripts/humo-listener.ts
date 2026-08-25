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

/**
 * Best-effort parser for @HUMOcardbot's notification text. No real sample
 * message was available while writing this, so it looks for the two
 * pieces of information any such notification has to contain — an amount
 * and a card reference — under a few common phrasings, rather than
 * matching one exact template. THIS NEEDS CALIBRATION: paste the first
 * real notification text into the "sample messages" below once you have
 * one, and adjust the regexes to match it exactly. A message that fails
 * to parse is simply skipped (logged, not forwarded) — that top-up just
 * waits for manual admin review, it never causes a wrong credit.
 */
function parseHumoMessage(text: string): { cardHint: string; amountMinor: number } | null {
  // Amount: a run of digits with optional space/comma/dot thousands
  // separators, e.g. "50 000", "50,000.00", "50000" — followed by (or
  // preceded by) a currency marker so we don't accidentally match a card
  // number as an amount.
  const amountMatch = text.match(/([\d][\d\s.,]*\d|\d)\s*(?:so'?m|sum|uzs)/i);
  const amountRaw = amountMatch?.[1];
  if (!amountRaw) return null;
  const digitsOnly = amountRaw.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const amountMinor = Number(digitsOnly) * 100;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null;

  // Card hint: the last group of 4+ digits appearing near "karta"/"card"/
  // "*"/"№", falling back to the last 4-digit group anywhere in the message.
  const cardMatch =
    text.match(/(?:karta|card|№|\*)\D{0,10}(\d{4,})/i) ?? [...text.matchAll(/(\d{4,})/g)].pop();
  const cardHint = cardMatch?.[1]?.slice(-4);
  if (!cardHint || cardHint.length < 4) return null;

  return { cardHint, amountMinor };
}

async function forwardTransaction(payload: { cardHint: string; amountMinor: number; rawMessage: string }) {
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
    await forwardTransaction({ ...parsed, rawMessage: text });
  }, new NewMessage({}));

  console.log('[humo-listener] listening... (Ctrl+C to stop)');
}

main().catch((error) => {
  console.error('[humo-listener] fatal error', error);
  process.exit(1);
});
