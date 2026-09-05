import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { adminLogin } from '../src/modules/admin/admin-auth.service.js';

// Exercises adminLogin()'s brute-force lockout against a real database —
// the whole point is the read-then-conditionally-update on failedLoginAttempts/
// lockedUntil, which a stubbed client would risk getting subtly wrong.

const prisma = new PrismaClient();
const ctx = { prisma };

const EMAIL = `vitest-lockout-${Date.now()}@uzdonate.dev`;
const PASSWORD = 'correct-horse-battery-staple';
// Must match MAX_FAILED_ATTEMPTS in admin-auth.service.ts.
const MAX_FAILED_ATTEMPTS = 5;

let adminId: string;

describe('adminLogin (live DB) — brute-force lockout', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const admin = await prisma.adminUser.create({
      data: { email: EMAIL, passwordHash, fullName: 'Vitest Lockout Admin', role: 'SUPPORT' },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.adminUser.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  });

  it('locks the account after MAX_FAILED_ATTEMPTS consecutive wrong passwords, then rejects even the correct one', async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await expect(adminLogin(ctx, { email: EMAIL, password: 'wrong' })).rejects.toThrow('Invalid credentials');
    }
    const beforeLock = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    expect(beforeLock.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);
    expect(beforeLock.lockedUntil).toBeNull();

    // The final failure crosses the threshold and locks the account.
    await expect(adminLogin(ctx, { email: EMAIL, password: 'wrong' })).rejects.toThrow('Invalid credentials');
    const afterLock = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    expect(afterLock.failedLoginAttempts).toBe(0);
    expect(afterLock.lockedUntil).not.toBeNull();
    expect(afterLock.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Even the correct password is refused while locked.
    await expect(adminLogin(ctx, { email: EMAIL, password: PASSWORD })).rejects.toThrow(
      'Account temporarily locked due to too many failed attempts',
    );
  });

  it('clears the lockout and resets the counter on the next successful login', async () => {
    // Simulate the lockout window having already passed.
    await prisma.adminUser.update({ where: { id: adminId }, data: { lockedUntil: new Date(Date.now() - 1000) } });

    const result = await adminLogin(ctx, { email: EMAIL, password: PASSWORD });
    expect(result.admin.email).toBe(EMAIL);

    const afterSuccess = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    expect(afterSuccess.failedLoginAttempts).toBe(0);
    expect(afterSuccess.lockedUntil).toBeNull();
  });
});
