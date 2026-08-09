import { describe, expect, it, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('health & readiness', () => {
  let app: FastifyInstance;

  it('builds the app', async () => {
    app = await buildApp();
    expect(app).toBeDefined();
  });

  it('GET /health returns 200 without touching the database', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /ready returns 503 when the database is unreachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(503);
  });

  it('GET /unknown-route returns a structured 404', async () => {
    const response = await app.inject({ method: 'GET', url: '/unknown-route' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  afterAll(async () => {
    await app.close();
  });
});
