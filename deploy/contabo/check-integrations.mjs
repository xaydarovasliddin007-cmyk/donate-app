import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { parse } = require('dotenv');
const credential = parse(readFileSync(path.join(process.env.CREDENTIALS_DIRECTORY, 'environment')));
async function telegram(token, method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  return payload.result;
}
const result = {};
for (const [label, key] of [['store', 'TELEGRAM_BOT_TOKEN'], ['receipts', 'TOPUP_REVIEW_BOT_TOKEN']]) {
  try {
    const me = await telegram(credential[key], 'getMe');
    const webhook = await telegram(credential[key], 'getWebhookInfo');
    result[label] = { username: me.username, webhook: webhook.url, pending: webhook.pending_update_count, lastError: webhook.last_error_message ?? null };
    if (label === 'receipts') result.receipts.recipientIsThisBot = String(me.id) === credential.TOPUP_REVIEW_CHAT_ID;
  } catch (error) { result[label] = { error: error.message }; }
}
if (credential.RSC_API_KEY) {
  try {
    const response = await fetch('https://resell.codes/api/v1/top-ups/categories', { headers: { Authorization: `Bearer ${credential.RSC_API_KEY}` }, signal: AbortSignal.timeout(15000) });
    result.providerReadOnly = { http: response.status, authenticated: response.ok, conversionRateConfigured: Boolean(credential.RSC_USD_UZS_RATE) };
    await response.arrayBuffer();
  } catch { result.providerReadOnly = { networkError: true }; }
}
console.log(JSON.stringify(result));
