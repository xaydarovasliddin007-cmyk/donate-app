import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './password.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../lib/duration.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

interface AuthContext {
  prisma: PrismaClient;
  signAccessToken: FastifyInstance['jwt']['sign'];
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: { id: string; email: string | null; phone: string | null; displayName: string | null; locale: string; role: string }) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
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

  // Constant-shape response for unknown user vs wrong password: avoids
  // leaking which accounts exist via response timing/content.
  const passwordMatches = user ? await verifyPassword(user.passwordHash, input.password) : await verifyPassword(
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    input.password,
  );

  if (!user || !passwordMatches || user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Invalid credentials');
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
