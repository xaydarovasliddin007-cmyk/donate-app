import { randomBytes } from 'node:crypto';

/** Short, human-readable order reference — not used as a security token, just a display ID. */
export function generateOrderNumber(): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `DA-${timestampPart}-${randomPart}`;
}
