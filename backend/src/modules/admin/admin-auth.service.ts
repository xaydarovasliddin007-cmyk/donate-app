import type { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../auth/password.js';
import { generateRefreshToken, hashRefreshToken } from '../auth/refresh-token.js';
import { env } from '../../config/env.js';
import { parseDurationMs } from '../../lib/duration.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { signAdminAccessToken } from './admin-token.js';
import type { AdminLoginInput } from './admin-auth.schemas.js';

interface AdminAuthContext {
  prisma: PrismaClient;
}

function toPublicAdmin(admin: { id: string; email: string; fullName: string; role: string }) {
  return { id: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role };
}

async function issueAdminTokenPair(ctx: AdminAuthContext, admin: { id: string; role: string }) {
  const accessToken = signAdminAccessToken({ sub: admin.id, role: admin.role, scope: 'admin' });
  const { token: refreshToken, tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseDurationMs(env.ADMIN_JWT_REFRESH_TTL));

  await ctx.prisma.adminRefreshToken.create({
    data: { adminUserId: admin.id, tokenHash, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function adminLogin(ctx: AdminAuthContext, input: AdminLoginInput) {
  const admin = await ctx.prisma.adminUser.findUnique({ where: { email: input.email } });

  // Constant-shape response for unknown admin vs wrong password.
  const passwordMatches = admin
    ? await verifyPassword(admin.passwordHash, input.password)
    : await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        input.password,
      );

  if (!admin || !passwordMatches || !admin.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const tokens = await issueAdminTokenPair(ctx, admin);
  return { admin: toPublicAdmin(admin), ...tokens };
}

export async function adminRefresh(ctx: AdminAuthContext, refreshTokenValue: string) {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  const stored = await ctx.prisma.adminRefreshToken.findUnique({
    where: { tokenHash },
    include: { adminUser: true },
  });

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }
  if (stored.revokedAt || stored.expiresAt < new Date()) {
    await ctx.prisma.adminRefreshToken.updateMany({
      where: { adminUserId: stored.adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token is no longer valid');
  }
  if (!stored.adminUser.isActive) {
    throw new UnauthorizedError('Admin account is disabled');
  }

  const tokens = await issueAdminTokenPair(ctx, stored.adminUser);
  await ctx.prisma.adminRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  return { admin: toPublicAdmin(stored.adminUser), ...tokens };
}

export async function adminLogout(ctx: AdminAuthContext, refreshTokenValue: string) {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  await ctx.prisma.adminRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
