import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('account deletion + admin RBAC/audit route protection', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('POST /api/v1/auth/account/delete-request without a token returns 401', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/account/delete-request' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('GET /api/v1/admin/admins without an admin token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/admins' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/admin/admins without an admin token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins',
      payload: { email: 'x@example.com', password: 'password123', fullName: 'X', role: 'SUPPORT' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PATCH /api/v1/admin/admins/:id without an admin token returns 401', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/admins/00000000-0000-0000-0000-000000000000',
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/audit-logs without an admin token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/audit-logs' });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: role-gating (SUPER_ADMIN-only) and actual
  // create/update/list behavior — requires a live PostgreSQL instance to
  // seed a real admin session. See backend/README.md.

  afterAll(async () => {
    await app.close();
  });
});
