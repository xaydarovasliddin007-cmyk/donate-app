import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('saved-games route protection', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
  });

  it('GET /api/v1/saved-games without a token returns 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/saved-games' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('PUT /api/v1/saved-games/:gameId without a token returns 401', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/saved-games/00000000-0000-0000-0000-000000000000',
      payload: { playerId: '123456789' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('DELETE /api/v1/saved-games/:gameId without a token returns 401', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/saved-games/00000000-0000-0000-0000-000000000000',
    });
    expect(response.statusCode).toBe(401);
  });

  // Not covered here: successful list/upsert/delete and the order-creation
  // auto-save (recordPlayerProfileFromOrder) — all require a live PostgreSQL
  // instance. See backend/README.md.

  afterAll(async () => {
    await app.close();
  });
});
