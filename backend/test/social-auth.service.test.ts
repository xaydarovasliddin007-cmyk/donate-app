import { randomUUID, randomInt } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
const verifyGoogle = vi.hoisted(() => vi.fn());
vi.mock('../src/modules/auth/google-token.js', () => ({ verifyGoogleIdToken: verifyGoogle }));
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { UnauthorizedError } from '../src/lib/errors.js';
import { guestAuth } from '../src/modules/auth/auth.service.js';
import { approveGoogleRequest, approveTelegramRequest, createSocialRequest, exchangeSocialRequest } from '../src/modules/auth/social-auth.service.js';

describe('cross-platform UZDONATE identity', () => {
  let app: FastifyInstance;
  let ctx: { prisma: FastifyInstance['prisma']; signAccessToken: FastifyInstance['jwt']['sign'] };
  const users: string[] = [];
  const requests: string[] = [];
  const original = { publicUrl: env.PUBLIC_APP_URL, google: env.GOOGLE_CLIENT_ID, telegram: env.TELEGRAM_BOT_TOKEN };
  beforeAll(async () => {
    env.PUBLIC_APP_URL = 'https://uzdonate.uz';
    env.GOOGLE_CLIENT_ID = 'isolated.apps.googleusercontent.com';
    env.TELEGRAM_BOT_TOKEN = '123456789:isolated-store-token';
    app = await buildApp(); await app.ready();
    ctx = { prisma: app.prisma, signAccessToken: app.jwt.sign.bind(app.jwt) };
  });
  beforeEach(() => {
    verifyGoogle.mockReset();
    verifyGoogle.mockResolvedValue({ googleId: randomUUID(), email: `${randomUUID()}@uzdonate.dev`, emailVerified: true, name: 'Verified user' });
  });
  afterAll(async () => {
    await app.prisma.socialAuthRequest.deleteMany({ where: { id: { in: requests } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.close();
    env.PUBLIC_APP_URL = original.publicUrl; env.GOOGLE_CLIENT_ID = original.google; env.TELEGRAM_BOT_TOKEN = original.telegram;
  });
  async function start(provider: 'google' | 'telegram', userId?: string) {
    const request = await createSocialRequest(ctx, provider, 'uz', userId);
    requests.push(request.id); return request;
  }
  async function guest() {
    const session = await guestAuth(ctx, { deviceId: randomUUID(), locale: 'uz' }, {});
    users.push(session.user.id); return session;
  }

  it('requires a signed-in account to initiate linking and exposes no raw Telegram identity endpoint', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/requests/link', payload: { provider: 'telegram' } })).statusCode).toBe(401);
    const request = await start('telegram');
    expect((await app.inject({ method: 'POST', url: `/api/v1/auth/requests/${request.id}/telegram`, payload: { id: 123, first_name: 'Fake' } })).statusCode).toBe(404);
    const info = await app.inject(`/api/v1/auth/requests/${request.id}`);
    expect(info.headers['cache-control']).toBe('no-store');
    expect(info.json()).not.toHaveProperty('requestSecret');
  });
  it('requires provider verification and stores neither request secret, plaintext code nor Google token', async () => {
    const request = await start('google');
    verifyGoogle.mockRejectedValueOnce(new UnauthorizedError('Invalid Google credential'));
    await expect(approveGoogleRequest(ctx, request.id, 'invalid')).rejects.toThrow('Invalid Google credential');
    expect((await app.prisma.socialAuthRequest.findUniqueOrThrow({ where: { id: request.id } })).codeHash).toBeNull();
    const approved = await approveGoogleRequest(ctx, request.id, 'external-id-token-not-for-storage');
    const stored = await app.prisma.socialAuthRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(stored.requestSecretHash).not.toBe(request.requestSecret);
    expect(stored.codeHash).not.toBe(approved.code);
    expect(JSON.stringify(stored)).not.toContain('external-id-token-not-for-storage');
  });
  it('does not let an unknown request secret consume or exhaust another request', async () => {
    const request = await start('google');
    const approved = await approveGoogleRequest(ctx, request.id, 'verified');
    await expect(exchangeSocialRequest(ctx, request.id, 'wrong-secret', approved.code, {})).rejects.toThrow('Invalid sign-in request');
    const stored = await app.prisma.socialAuthRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(stored.usedAt).toBeNull(); expect(stored.attempts).toBe(0);
  });
  it('locks the request after five wrong codes', async () => {
    const request = await start('google');
    const approved = await approveGoogleRequest(ctx, request.id, 'verified');
    const wrong = approved.code === '00000000' ? '11111111' : '00000000';
    for (let attempt = 0; attempt < 5; attempt++) await expect(exchangeSocialRequest(ctx, request.id, request.requestSecret, wrong, {})).rejects.toThrow();
    await expect(exchangeSocialRequest(ctx, request.id, request.requestSecret, approved.code, {})).rejects.toThrow('expired');
  });
  it('rejects expired requests and changes of provider identity', async () => {
    const request = await start('google');
    await approveGoogleRequest(ctx, request.id, 'first');
    verifyGoogle.mockResolvedValueOnce({ googleId: randomUUID(), email: `${randomUUID()}@uzdonate.dev`, emailVerified: true });
    await expect(approveGoogleRequest(ctx, request.id, 'second')).rejects.toThrow('another account');
    await app.prisma.socialAuthRequest.update({ where: { id: request.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(approveGoogleRequest(ctx, request.id, 'expired')).rejects.toThrow('expired');
  });
  it('makes duplicate verified Telegram deliveries idempotent without extending expiry', async () => {
    const request = await start('telegram');
    const identity = { id: randomInt(100_000_000, 900_000_000), first_name: 'Telegram' };
    const first = await approveTelegramRequest(ctx, request.id, identity);
    const second = await approveTelegramRequest(ctx, request.id, identity);
    expect(second).toEqual(first);
  });
  it('keeps the same UZDONATE ID and wallet when linking Google and Telegram, and signs in from either', async () => {
    const current = await guest();
    const wallet = await app.prisma.wallet.update({ where: { userId: current.user.id }, data: { balanceMinor: 12345 } });
    const google = await start('google', current.user.id);
    const googleCode = await approveGoogleRequest(ctx, google.id, 'verified');
    const saved = await exchangeSocialRequest(ctx, google.id, google.requestSecret, googleCode.code, {});
    expect(saved.user.id).toBe(current.user.id); expect(saved.user.publicId).toBe(current.user.publicId);
    expect(saved.user.hasGoogleAccount).toBe(true); expect(saved.user.isGuest).toBe(false);
    const telegram = await start('telegram', current.user.id);
    const identity = { id: randomInt(100_000_000, 900_000_000), first_name: 'Same user' };
    const telegramCode = await approveTelegramRequest(ctx, telegram.id, identity);
    const linked = await exchangeSocialRequest(ctx, telegram.id, telegram.requestSecret, telegramCode.code, {});
    expect(linked.user.id).toBe(current.user.id); expect(linked.user.hasTelegramAccount).toBe(true);
    expect(await app.prisma.wallet.findUniqueOrThrow({ where: { userId: current.user.id } })).toMatchObject({ id: wallet.id, balanceMinor: 12345 });
    const next = await start('telegram');
    const nextCode = await approveTelegramRequest(ctx, next.id, identity);
    const loggedIn = await exchangeSocialRequest(ctx, next.id, next.requestSecret, nextCode.code, {});
    expect(loggedIn.user.id).toBe(current.user.id); expect(loggedIn.user.publicId).toBe(current.user.publicId);
  });
  it('allows only one concurrent exchange and rejects replay', async () => {
    const request = await start('google');
    const approved = await approveGoogleRequest(ctx, request.id, 'verified');
    const results = await Promise.allSettled([0, 1].map(() => exchangeSocialRequest(ctx, request.id, request.requestSecret, approved.code, {})));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const success = results.find(result => result.status === 'fulfilled');
    if (success?.status === 'fulfilled') users.push(success.value.user.id);
    await expect(exchangeSocialRequest(ctx, request.id, request.requestSecret, approved.code, {})).rejects.toThrow('expired');
  });
  it('does not silently merge separately owned Telegram accounts or move wallets', async () => {
    const owner = await guest(); const target = await guest();
    const telegramId = randomInt(100_000_000, 900_000_000);
    await app.prisma.user.update({ where: { id: owner.user.id }, data: { telegramId: String(telegramId) } });
    const request = await start('telegram', target.user.id);
    const approved = await approveTelegramRequest(ctx, request.id, { id: telegramId, first_name: 'Owner' });
    await expect(exchangeSocialRequest(ctx, request.id, request.requestSecret, approved.code, {})).rejects.toThrow('another UZDONATE account');
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).telegramId).toBeNull();
    expect((await app.prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).telegramId).toBe(String(telegramId));
  });
});
