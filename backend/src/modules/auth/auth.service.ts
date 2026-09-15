import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './password.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';
import { generateVerificationCode, hashVerificationCode } from './email-verification.js';
import { verifyGoogleIdToken } from './google-token.js';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../lib/duration.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { generateUniquePublicId } from '../../lib/public-id.js';
import { formatMinorAmount } from '../../lib/money.js';
import { notifyAdmins } from '../../lib/telegram.js';
import { sendEmail } from '../../lib/mailer.js';
import { verificationCodeEmail, passwordResetEmail } from '../../lib/email-templates.js';
import { getWalletSummary } from '../wallet/wallet.service.js';
import { validateTelegramInitData } from '../telegram/telegram-auth.js';
import { ServiceUnavailableError } from '../../lib/errors.js';
import type {
  GoogleAuthInput,
  GuestAuthInput,
  LoginInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  RegisterCompleteInput,
  RegisterRequestCodeInput,
} from './auth.schemas.js';

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;

async function issueVerificationCode(ctx: AuthContext, userId: string, email: string): Promise<void> {
  const { code, codeHash } = generateVerificationCode();
  await ctx.prisma.emailVerificationToken.create({
    data: { userId, tokenHash: codeHash, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
  });

  // Fire-and-forget, matching notifyAdmins()/other external-service calls in
  // this codebase — an SMTP outage or missing config must never break
  // registration/resend itself.
  void sendEmail({ to: email, ...verificationCodeEmail(code) });
}

/** Distinct code so the client can show "spend down your balance or contact support" instead of a generic error. */
export class WalletNotEmptyError extends AppError {
  constructor() {
    super(409, 'WALLET_NOT_EMPTY', 'Wallet balance must be zero before account deletion');
    this.name = 'WalletNotEmptyError';
  }
}

interface AuthContext {
  prisma: PrismaClient;
  signAccessToken: FastifyInstance['jwt']['sign'];
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function toPublicUser(user: {
  id: string;
  publicId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  role: string;
  discountPercent?: number;
  googleId?: string | null;
  telegramId?: string | null;
  emailVerifiedAt?: Date | null;
}) {
  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    role: user.role,
    // 0 for virtually everyone — only set for reseller/partner accounts an
    // admin has given a standing discount to (see User.discountPercent).
    discountPercent: user.discountPercent ?? 0,
    // Never the raw googleId — just whether an account is linked, for the
    // security center's "Google account connected" indicator.
    hasGoogleAccount: Boolean(user.googleId),
    hasTelegramAccount: Boolean(user.telegramId),
    // A Google-linked account's email was already verified by Google before
    // we ever saw it, so it counts as verified even though emailVerifiedAt
    // is never set for it.
    isEmailVerified: Boolean(user.emailVerifiedAt) || Boolean(user.googleId),
    isGuest: Boolean(user.email?.endsWith('@guest.uzdonate.uz')),
  };
}

async function issueTokenPair(
  ctx: AuthContext,
  user: { id: string; role: string },
  meta: { userAgent?: string; ipAddress?: string },
): Promise<TokenPair> {
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));

  const session = await ctx.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  // Embedding the refresh token row's own id as `sid` is what lets the
  // security center mark "this is the device you're looking at right now"
  // — refresh rotates to a new row (and a new access token carrying its
  // id) every time, so the client's latest access token always carries
  // the sid of its latest, still-live refresh token row.
  const accessToken = ctx.signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  return { accessToken, refreshToken };
}

export async function telegramAuth(ctx: AuthContext, initData: string, meta: { userAgent?: string; ipAddress?: string }) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new ServiceUnavailableError('Telegram login is not configured');
  const identity = validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  const telegramId = String(identity.id);
  const publicId = await generateUniquePublicId(ctx.prisma);
  const profile = {
    displayName: [identity.first_name, identity.last_name].filter(Boolean).join(' '),
    avatarUrl: identity.photo_url,
  };
  const user = await ctx.prisma.user.upsert({
    where: { telegramId },
    create: { telegramId, publicId, ...profile, locale: identity.language_code === 'ru' ? 'ru' : 'uz', wallet: { create: {} } },
    update: profile,
  });
  if (user.status !== 'ACTIVE') throw new UnauthorizedError('This account is not active');
  return { user: toPublicUser(user), ...await issueTokenPair(ctx, user, meta) };
}

/**
 * Step 1 of registration: send a code to the email, but create nothing yet
 * — no User row until the code is confirmed with a password in
 * completeRegistration(). Calling this again for the same email (e.g. the
 * user asks to resend) just overwrites the pending row with a fresh code.
 */
export async function requestRegistration(ctx: AuthContext, input: RegisterRequestCodeInput): Promise<void> {
  const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const { code, codeHash } = generateVerificationCode();
  await ctx.prisma.pendingRegistration.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      codeHash,
      displayName: input.displayName,
      locale: input.locale,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
    },
    update: {
      codeHash,
      displayName: input.displayName,
      locale: input.locale,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
    },
  });

  // Fire-and-forget, matching issueVerificationCode()'s reasoning below.
  void sendEmail({ to: input.email, ...verificationCodeEmail(code) });
}

/**
 * Step 2: the code just proved the email is real, so the account is created
 * already verified — no separate post-signup verification step needed.
 */
export async function completeRegistration(
  ctx: AuthContext,
  input: RegisterCompleteInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const pending = await ctx.prisma.pendingRegistration.findUnique({ where: { email: input.email } });
  if (!pending || pending.expiresAt < new Date() || pending.codeHash !== hashVerificationCode(input.code)) {
    throw new UnauthorizedError('Invalid or expired verification code');
  }

  const [passwordHash, publicId] = await Promise.all([
    hashPassword(input.password),
    generateUniquePublicId(ctx.prisma),
  ]);

  const user = await ctx.prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        publicId,
        email: pending.email,
        passwordHash,
        displayName: pending.displayName,
        locale: pending.locale,
        emailVerifiedAt: new Date(),
        // Every account gets exactly one wallet, created atomically with
        // the account itself — nothing in this codebase should ever need
        // to handle "a user with no wallet".
        wallet: { create: {} },
      },
    });
    await tx.pendingRegistration.delete({ where: { email: pending.email } });
    return created;
  });

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(
  ctx: AuthContext,
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });

  // Constant-shape response for unknown user / Google-only account (no
  // password set) / wrong password: avoids leaking which accounts exist or
  // how they authenticate via response timing/content.
  const passwordMatches = await verifyPassword(
    user?.passwordHash ??
      '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    input.password,
  );

  if (!user || !passwordMatches || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Invalid credentials');
  }

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Sends a reset code if — and only behaviorally-identically-if-not — an
 * account with this email exists: the caller always sees the same 204,
 * whether or not the email is registered, so this can never be used to
 * probe which emails have accounts.
 */
export async function requestPasswordReset(ctx: AuthContext, input: PasswordResetRequestInput): Promise<void> {
  const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.status !== 'ACTIVE') {
    return;
  }

  const { code, codeHash } = generateVerificationCode();
  await ctx.prisma.passwordResetToken.create({
    data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
  });

  // Fire-and-forget, matching issueVerificationCode()'s reasoning above.
  void sendEmail({ to: input.email, ...passwordResetEmail(code) });
}

/**
 * Confirms the emailed code and sets a new password — this doubles as a way
 * for a Google-only account to add password login, since any account with
 * this email can go through it, not just ones that already have a password.
 * Every existing session is revoked before issuing a fresh one for this
 * device: a forgotten/leaked password is exactly the scenario where an
 * attacker may already be logged in elsewhere.
 */
export async function resetPassword(
  ctx: AuthContext,
  input: PasswordResetInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Invalid or expired code');
  }

  const token = await ctx.prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      codeHash: hashVerificationCode(input.code),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!token) {
    throw new UnauthorizedError('Invalid or expired code');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await ctx.prisma.$transaction([
    ctx.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    ctx.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    ctx.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Never blocks login/registration — an unverified account can still use the
 * app. Verification just flips `emailVerifiedAt`, which the client can use
 * to nudge the user (e.g. a "verify your email" banner) without anything
 * else in the system depending on it.
 */
export async function verifyEmail(ctx: AuthContext, userId: string, code: string) {
  const codeHash = hashVerificationCode(code);
  const token = await ctx.prisma.emailVerificationToken.findFirst({
    where: { userId, tokenHash: codeHash, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!token) {
    throw new UnauthorizedError('Invalid or expired verification code');
  }

  await ctx.prisma.$transaction([
    ctx.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    ctx.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
}

export async function resendVerificationEmail(ctx: AuthContext, userId: string) {
  const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt || !user.email) {
    return;
  }
  await issueVerificationCode(ctx, user.id, user.email);
}

export async function googleAuth(
  ctx: AuthContext,
  input: GoogleAuthInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const identity = await verifyGoogleIdToken(input.idToken);

  // 1) Already-linked Google account -> straightforward login.
  let user = await ctx.prisma.user.findUnique({ where: { googleId: identity.googleId } });

  if (!user) {
    // 2) No account linked to this Google ID yet. Only link to an existing
    // email/password account when Google itself has verified that email —
    // otherwise someone who merely knows another person's email address
    // could hijack their account by signing in with that email via Google
    // elsewhere. An unverified match always creates a fresh account instead
    // of linking to it.
    const existingByEmail = identity.emailVerified
      ? await ctx.prisma.user.findUnique({ where: { email: identity.email } })
      : null;

    try {
      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== identity.googleId) {
          throw new ConflictError('This email is already linked to a different Google account');
        }
        user = await ctx.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: identity.googleId,
            avatarUrl: existingByEmail.avatarUrl ?? identity.avatarUrl,
            displayName: existingByEmail.displayName ?? identity.name,
          },
        });
      } else {
        const publicId = await generateUniquePublicId(ctx.prisma);
        user = await ctx.prisma.user.create({
          data: {
            publicId,
            email: identity.email,
            googleId: identity.googleId,
            displayName: identity.name,
            avatarUrl: identity.avatarUrl,
            locale: input.locale,
            wallet: { create: {} },
          },
        });
      }
    } catch (err) {
      // A concurrent request (e.g. a double-tap) may have won the race and
      // created/linked the same googleId first — treat that as success
      // rather than surfacing a raw DB conflict.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        user = await ctx.prisma.user.findUnique({ where: { googleId: identity.googleId } });
      } else {
        throw err;
      }
    }
  }

  if (!user || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('This account is not active');
  }

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Creates or retrieves a persistent guest customer account for instant,
 * login-free checkout and balance top-ups (Codashop/Midasbuy style flow).
 * Automatically initializes a wallet with zero balance if new.
 */
export async function guestAuth(
  ctx: AuthContext,
  input: GuestAuthInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const sanitizedId = input.deviceId
    ? input.deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    : randomUUID().replace(/-/g, '');
  const guestEmail = `guest_${sanitizedId}@guest.uzdonate.uz`;

  let user = await ctx.prisma.user.findUnique({ where: { email: guestEmail } });

  if (!user) {
    const publicId = await generateUniquePublicId(ctx.prisma);
    user = await ctx.prisma.user.create({
      data: {
        publicId,
        email: guestEmail,
        displayName: 'Mehmon',
        locale: input.locale,
        role: 'CUSTOMER',
        wallet: { create: {} },
      },
    });
  }

  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('This guest account is suspended');
  }

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(
  ctx: AuthContext,
  refreshTokenValue: string,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  const stored = await ctx.prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (stored.revokedAt || stored.expiresAt < new Date()) {
    // Reuse of a revoked/expired token is a signal of token theft: kill the
    // whole session family for this user, not just this one token.
    await ctx.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token is no longer valid');
  }

  if (stored.user.status !== 'ACTIVE') {
    // A suspended/deleted account must not be able to keep minting fresh
    // access tokens off an old refresh token — kill the whole session
    // family, matching what a fresh login attempt would already reject.
    await ctx.prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('This account is not active');
  }

  const tokens = await issueTokenPair(ctx, stored.user, meta);

  await ctx.prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByTokenHash: hashRefreshToken(tokens.refreshToken) },
  });

  return { user: toPublicUser(stored.user), ...tokens };
}

export async function logout(ctx: AuthContext, refreshTokenValue: string) {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  await ctx.prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * "Active sessions" for the security center — reuses `refresh_tokens`
 * directly rather than a separate Session model: a live (non-revoked,
 * non-expired) refresh token IS a logged-in session on some device, and it
 * already carries the device fingerprint (`userAgent`/`ipAddress`) captured
 * at login/refresh time. The raw token hash is never returned.
 */
export async function listSessions(ctx: AuthContext, userId: string, currentSessionId?: string) {
  const sessions = await ctx.prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
  });
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
}

export async function revokeSession(ctx: AuthContext, userId: string, sessionId: string) {
  const session = await ctx.prisma.refreshToken.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  if (session.userId !== userId) {
    throw new ForbiddenError('This session does not belong to you');
  }
  await ctx.prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/** Logout everywhere — revokes every active session for this user, including the one making this request. */
export async function revokeAllSessions(ctx: AuthContext, userId: string) {
  await ctx.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Self-service account deletion. The wallet is closed-loop (no withdrawal —
 * see wallet.service.ts), so a non-zero balance would otherwise strand the
 * user's money; deletion is blocked until it's spent down or support settles
 * it manually. Never a hard delete — orders/payments/ledger history must
 * survive for financial/audit reasons, so this only soft-deletes the account
 * (status=DELETED) and kills every session.
 */
export async function requestAccountDeletion(ctx: AuthContext, userId: string) {
  const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const wallet = await getWalletSummary(ctx, userId);
  if (wallet.balanceMinor > 0) {
    throw new WalletNotEmptyError();
  }

  await ctx.prisma.$transaction([
    ctx.prisma.user.update({ where: { id: userId }, data: { status: 'DELETED' } }),
    ctx.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  notifyAdmins(
    `🗑️ <b>Account deletion</b> — ${user.publicId} (${user.email ?? user.phone ?? 'no contact'})\n` +
      `Final wallet balance: ${formatMinorAmount(wallet.balanceMinor, wallet.currency)}`,
  );
}
