import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from '../src/modules/orders/order-state-machine.js';

describe('order state machine', () => {
  it('allows the happy path PENDING -> PAID -> PROCESSING -> COMPLETED', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'COMPLETED')).toBe(true);
  });

  it('allows the documented failure paths', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransition('PENDING', 'FAILED')).toBe(true);
    expect(canTransition('PAID', 'FAILED')).toBe(true);
    expect(canTransition('PROCESSING', 'FAILED')).toBe(true);
  });

  it('allows refunds only from PAID or COMPLETED', () => {
    expect(canTransition('PAID', 'REFUNDED')).toBe(true);
    expect(canTransition('COMPLETED', 'REFUNDED')).toBe(true);
    expect(canTransition('PENDING', 'REFUNDED')).toBe(false);
  });

  it('rejects skipping straight from PENDING to COMPLETED', () => {
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
  });

  it('rejects any transition out of terminal states except the documented admin retry', () => {
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
    expect(canTransition('REFUNDED', 'COMPLETED')).toBe(false);
    expect(canTransition('FAILED', 'PROCESSING')).toBe(true); // admin retry only
    expect(canTransition('FAILED', 'COMPLETED')).toBe(false);
  });

  it('assertTransition throws on an invalid transition', () => {
    expect(() => assertTransition('COMPLETED', 'PENDING')).toThrow();
  });

  it('assertTransition does not throw on a valid transition', () => {
    expect(() => assertTransition('PENDING', 'PAID')).not.toThrow();
  });
});
