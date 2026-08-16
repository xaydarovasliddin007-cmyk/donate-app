import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('notifications route protection', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('GET /api/v1/notifications without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('POST /api/v1/notifications/:id/read without a token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/00000000-0000-0000-0000-000000000000/read',
    });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/v1/notifications/read-all without a token returns 401', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all' });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: actually listing/creating/marking notifications —
  // requires a live PostgreSQL instance. See backend/README.md.

  afterAll(async () => {
    await app.close();
  });
});
