import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerCompleteSchema,
  registerRequestCodeSchema,
} from '../src/modules/auth/auth.schemas.js';

describe('registerRequestCodeSchema', () => {
  it('accepts a valid request-code payload', () => {
    const result = registerRequestCodeSchema.safeParse({
      email: 'User@Example.com',
      locale: 'ru',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('defaults locale to uz when omitted', () => {
    const result = registerRequestCodeSchema.safeParse({ email: 'a@b.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe('uz');
    }
  });
});

describe('registerCompleteSchema', () => {
  it('accepts a valid completion payload', () => {
    const result = registerCompleteSchema.safeParse({
      email: 'User@Example.com',
      code: '123456',
      password: 'supersecret123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerCompleteSchema.safeParse({
      email: 'a@b.com',
      code: '123456',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a code that is not 6 digits', () => {
    const result = registerCompleteSchema.safeParse({
      email: 'a@b.com',
      code: '123',
      password: 'supersecret123',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a non-empty password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(result.success).toBe(false);
  });
});
