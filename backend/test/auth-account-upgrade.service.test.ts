import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { hashVerificationCode } from '../src/modules/auth/email-verification.js';

let app: FastifyInstance;
const users: string[] = [];
const emails: string[] = [];
const password = 'SecureTestPassword42!';
async function fixture(telegram = false, registered = false) {
  const suffix = randomUUID();
  const email = `upgrade-${suffix}@uzdonate.dev`;
  const user = await app.prisma.user.create({ data: {
    publicId: `UP-${suffix.slice(0, 8)}`,
    email: registered ? `existing-${suffix}@uzdonate.dev` : telegram ? null : `guest_${suffix}@guest.uzdonate.uz`,
    telegramId: telegram ? `test-${suffix}` : null,
    wallet: { create: { balanceMinor: 5_000_000 } },
  } });
  users.push(user.id); emails.push(email);
  await app.prisma.pendingRegistration.create({ data: {
    email, codeHash: hashVerificationCode('123456'), displayName: 'Website user', locale: 'uz',
    expiresAt: new Date(Date.now() + 900_000),
  } });
  return { user, email, headers: { authorization: `Bearer ${app.jwt.sign({ sub: user.id, role: 'CUSTOMER' })}` } };
}
describe('save a guest or Telegram account with verified email credentials', () => {
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => {
    await app.prisma.pendingRegistration.deleteMany({ where: { email: { in: emails } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
  });
  for (const telegram of [false, true]) it(`keeps the ${telegram ? 'Telegram' : 'guest'} identity and funded wallet, and allows normal email login`, async () => {
    const { user, email, headers } = await fixture(telegram);
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/account/complete', headers,
      payload: { email, code: '123456', password } });
    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ id: user.id, publicId: user.publicId, email, isGuest: false, isEmailVerified: true, hasTelegramAccount: telegram });
    const saved = await app.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { wallet: true } });
    expect(saved.wallet?.balanceMinor).toBe(5_000_000);
    expect(saved.telegramId).toBe(user.telegramId);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.id).toBe(user.id);
  });
  it('requires the current account token', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/account/complete', payload: { email: 'a@uzdonate.dev', code: '123456', password } });
    expect(response.statusCode).toBe(401);
  });
  it('rejects an incorrect code without changing the guest or consuming the valid code', async () => {
    const { user, email, headers } = await fixture();
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/account/complete', headers, payload: { email, code: '999999', password } });
    expect(response.statusCode).toBe(401);
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
    expect(await app.prisma.pendingRegistration.findUnique({ where: { email } })).not.toBeNull();
  });
  it('cannot replace an existing account email', async () => {
    const { user, email, headers } = await fixture(false, true);
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/account/complete', headers, payload: { email, code: '123456', password } });
    expect(response.statusCode).toBe(409);
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  });
});
