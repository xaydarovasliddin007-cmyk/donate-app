import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, ServiceUnavailableError, UnauthorizedError } from '../../lib/errors.js';
import { hashRefreshToken } from './refresh-token.js';
import { verifyGoogleIdToken, type GoogleIdentity } from './google-token.js';
import { googleIdentityAuth, linkGoogleIdentity, linkTelegramIdentity, telegramIdentityAuth, type AuthContext, type TelegramIdentity } from './auth.service.js';

export type SocialProvider = 'google' | 'telegram';
type Meta = { userAgent?: string; ipAddress?: string };
const requestLifetime = 10 * 60_000;
const codeLifetime = 5 * 60_000;
const googleIdentitySchema = z.object({ googleId: z.string().min(1), email: z.string().email(), emailVerified: z.literal(true), name: z.string().optional(), avatarUrl: z.string().url().optional() });
const telegramIdentitySchema = z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), first_name: z.string().min(1).max(256), last_name: z.string().max(256).optional(), language_code: z.string().optional(), photo_url: z.string().url().optional() });

function sameHash(left: string, right: string) {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
function codeFor(id: string, provider: string, subject: string) {
  const hex = createHmac('sha256', env.JWT_ACCESS_SECRET).update(`social-code:${id}:${provider}:${subject}`).digest('hex');
  return (BigInt(`0x${hex.slice(0, 16)}`) % 100_000_000n).toString().padStart(8, '0');
}
function hashCode(id: string, code: string) {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`social-proof:${id}:${code}`).digest('hex');
}

async function openRequest(ctx: AuthContext, id: string) {
  const request = await ctx.prisma.socialAuthRequest.findUnique({ where: { id } });
  if (!request || request.usedAt || request.expiresAt.getTime() <= Date.now() || request.attempts >= 5) {
    throw new UnauthorizedError('Sign-in request expired. Start again.');
  }
  return request;
}

export async function createSocialRequest(ctx: AuthContext, provider: SocialProvider, locale: string, targetUserId?: string) {
  if (provider === 'google' && !env.GOOGLE_CLIENT_ID) throw new ServiceUnavailableError('Google sign-in is not configured');
  if (provider === 'telegram' && !env.TELEGRAM_BOT_TOKEN) throw new ServiceUnavailableError('Telegram sign-in is not configured');
  if (!env.PUBLIC_APP_URL?.startsWith('https://')) throw new ServiceUnavailableError('Public sign-in address is not configured');
  if (targetUserId) {
    const user = await ctx.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('This account is not active');
  }
  await ctx.prisma.socialAuthRequest.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
  const requestSecret = randomBytes(32).toString('base64url');
  const request = await ctx.prisma.socialAuthRequest.create({ data: {
    provider, intent: targetUserId ? 'link' : 'login', locale, targetUserId,
    requestSecretHash: hashRefreshToken(requestSecret), expiresAt: new Date(Date.now() + requestLifetime),
  } });
  const authorizeUrl = provider === 'telegram'
    ? `https://t.me/uzdonate1bot?start=auth_${request.id}`
    : new URL(`/webapp/?auth_request=${request.id}`, env.PUBLIC_APP_URL).href;
  return { id: request.id, provider, intent: request.intent, requestSecret, authorizeUrl, expiresAt: request.expiresAt.toISOString() };
}

export async function socialRequestInfo(ctx: AuthContext, id: string) {
  const request = await openRequest(ctx, id);
  return { provider: request.provider, intent: request.intent, locale: request.locale,
    expiresAt: request.expiresAt.toISOString(), googleClientId: request.provider === 'google' ? env.GOOGLE_CLIENT_ID : null };
}

async function approve(ctx: AuthContext, id: string, provider: SocialProvider, identity: GoogleIdentity | TelegramIdentity) {
  const request = await openRequest(ctx, id);
  if (request.provider !== provider) throw new NotFoundError('Sign-in provider does not match');
  const subject = provider === 'google' ? (identity as GoogleIdentity).googleId : String((identity as TelegramIdentity).id);
  const code = codeFor(id, provider, subject);
  const codeHash = hashCode(id, code);
  // Repeated verified provider updates return the same code without extending TTL.
  if (request.codeHash) {
    if (!sameHash(request.codeHash, codeHash)) throw new ConflictError('This request was already confirmed by another account');
    return { code, expiresAt: request.expiresAt.toISOString() };
  }
  const expiresAt = new Date(Math.min(request.expiresAt.getTime(), Date.now() + codeLifetime));
  const changed = await ctx.prisma.socialAuthRequest.updateMany({
    where: { id, provider, usedAt: null, codeHash: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    data: { codeHash, identity: JSON.parse(JSON.stringify(identity)), expiresAt },
  });
  if (changed.count !== 1) throw new ConflictError('Sign-in request changed. Try again.');
  return { code, expiresAt: expiresAt.toISOString() };
}

export async function approveGoogleRequest(ctx: AuthContext, id: string, idToken: string) {
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity.emailVerified) throw new UnauthorizedError('Google must verify this email address');
  return approve(ctx, id, 'google', identity);
}

/** Only called after the private Telegram webhook and sender/chat are verified. */
export async function approveTelegramRequest(ctx: AuthContext, id: string, identity: TelegramIdentity) {
  const validated = telegramIdentitySchema.parse(identity);
  return approve(ctx, id, 'telegram', validated);
}

export async function exchangeSocialRequest(ctx: AuthContext, id: string, requestSecret: string, code: string, meta: Meta) {
  const request = await openRequest(ctx, id);
  if (!sameHash(request.requestSecretHash, hashRefreshToken(requestSecret))) throw new UnauthorizedError('Invalid sign-in request');
  if (!request.codeHash || !request.identity) throw new UnauthorizedError('Confirm your account first');
  if (!sameHash(request.codeHash, hashCode(id, code))) {
    await ctx.prisma.socialAuthRequest.updateMany({ where: { id, usedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    throw new UnauthorizedError('Invalid sign-in code');
  }
  const consumed = await ctx.prisma.socialAuthRequest.updateMany({
    where: { id, usedAt: null, codeHash: request.codeHash, requestSecretHash: request.requestSecretHash, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) throw new UnauthorizedError('Sign-in code was already used');
  if (request.provider === 'google') {
    const identity = googleIdentitySchema.parse(request.identity);
    return request.targetUserId ? linkGoogleIdentity(ctx, request.targetUserId, identity, meta) : googleIdentityAuth(ctx, identity, request.locale, meta);
  }
  const identity = telegramIdentitySchema.parse(request.identity);
  return request.targetUserId ? linkTelegramIdentity(ctx, request.targetUserId, identity, meta) : telegramIdentityAuth(ctx, identity, meta);
}
