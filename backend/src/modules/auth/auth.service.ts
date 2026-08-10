import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './password.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';
import { verifyGoogleIdToken } from './google-token.js';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../lib/duration.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import type { GoogleAuthInput, LoginInput, RegisterInput } from './auth.schemas.js';

interface AuthContext {
  prisma: PrismaClient;
  signAccessToken: FastifyInstance['jwt']['sign'];
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    role: user.role,
  };
}

async function issueTokenPair(
  ctx: AuthContext,
  user: { id: string; role: string },
  meta: { userAgent?: string; ipAddress?: string },
): Promise<TokenPair> {
  const accessToken = ctx.signAccessToken({ sub: user.id, role: user.role });
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_TTL));

  await ctx.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return { accessToken, refreshToken };
}

export async function register(
  ctx: AuthContext,
  input: RegisterInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  if (!input.email && !input.phone) {
    throw new ConflictError('Either email or phone is required');
  }

  const existing = await ctx.prisma.user.findFirst({
    where: {
      OR: [input.email ? { email: input.email } : undefined, input.phone ? { phone: input.phone } : undefined].filter(
        (clause): clause is NonNullable<typeof clause> => Boolean(clause),
      ),
    },
  });
  if (existing) {
    throw new ConflictError('An account with this email or phone already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await ctx.prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      displayName: input.displayName,
      locale: input.locale,
    },
  });

  const tokens = await issueTokenPair(ctx, user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(
  ctx: AuthContext,
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string },
) {
  if (!input.email && !input.phone) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const user = await ctx.prisma.user.findFirst({
    where: {
      OR: [input.email ? { email: input.email } : undefined, input.phone ? { phone: input.phone } : undefined].filter(
        (clause): clause is NonNullable<typeof clause> => Boolean(clause),
      ),
    },
  });

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
        user = await ctx.prisma.user.create({
          data: {
            email: identity.email,
            googleId: identity.googleId,
            displayName: identity.name,
            avatarUrl: identity.avatarUrl,
            locale: input.locale,
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
