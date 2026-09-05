import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from '../src/providers/click/click-webhook.js';

// Click's signature check is the ONLY thing standing between "a real
// merchant callback" and "anyone on the internet POSTing a fake payment
// confirmation" — if this silently computed the wrong hash, every real
// Click webhook would be rejected (safe) or, worse, a subtly wrong
// comparison could accept a forged one (not safe). Verified independently
// here against a hand-computed MD5, not just round-tripped through the
// same function.
const SECRET = 'test-secret-key';

function baseBody(overrides: Partial<Record<string, string>> = {}) {
  return {
    click_trans_id: '12345',
    service_id: '999',
    merchant_trans_id: 'payment-abc',
    amount: '50000.00',
    action: '0',
    sign_time: '2026-09-05 12:00:00',
    sign_string: '',
    ...overrides,
  };
}

describe('Click verifySignature', () => {
  it('accepts a Prepare (action=0) signature matching the documented field order', () => {
    const body = baseBody();
    const expected = createHash('md5')
      .update([body.click_trans_id, body.service_id, SECRET, body.merchant_trans_id, body.amount, body.action, body.sign_time].join(''))
      .digest('hex');

    expect(verifySignature({ ...body, sign_string: expected }, SECRET)).toBe(true);
  });

  it('accepts a Complete (action=1) signature, which additionally includes merchant_prepare_id', () => {
    const body = baseBody({ action: '1', merchant_prepare_id: 'attempt-xyz' });
    const expected = createHash('md5')
      .update(
        [
          body.click_trans_id,
          body.service_id,
          SECRET,
          body.merchant_trans_id,
          body.merchant_prepare_id,
          body.amount,
          body.action,
          body.sign_time,
        ].join(''),
      )
      .digest('hex');

    expect(verifySignature({ ...body, sign_string: expected }, SECRET)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const body = baseBody();
    const wrongSecretSig = createHash('md5')
      .update([body.click_trans_id, body.service_id, 'wrong-secret', body.merchant_trans_id, body.amount, body.action, body.sign_time].join(''))
      .digest('hex');

    expect(verifySignature({ ...body, sign_string: wrongSecretSig }, SECRET)).toBe(false);
  });

  it('rejects a signature computed for a different amount (tampered payload)', () => {
    const body = baseBody();
    const signatureForOriginalAmount = createHash('md5')
      .update([body.click_trans_id, body.service_id, SECRET, body.merchant_trans_id, body.amount, body.action, body.sign_time].join(''))
      .digest('hex');

    // Same signature, but the amount field itself was changed after signing.
    expect(verifySignature({ ...body, amount: '9999999.00', sign_string: signatureForOriginalAmount }, SECRET)).toBe(
      false,
    );
  });

  it('rejects an empty or garbage sign_string outright', () => {
    expect(verifySignature(baseBody({ sign_string: '' }), SECRET)).toBe(false);
    expect(verifySignature(baseBody({ sign_string: 'not-a-real-hash' }), SECRET)).toBe(false);
  });
});
