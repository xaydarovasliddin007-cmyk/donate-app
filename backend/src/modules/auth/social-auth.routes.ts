import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { ValidationError } from '../../lib/errors.js';
import { approveGoogleRequest, createSocialRequest, exchangeSocialRequest, socialRequestInfo } from './social-auth.service.js';

const startSchema = z.object({ provider: z.enum(['google', 'telegram']), locale: z.enum(['uz', 'ru', 'en']).default('uz') });
const googleSchema = z.object({ idToken: z.string().min(1).max(16384) });
const exchangeSchema = z.object({ requestSecret: z.string().min(40).max(128), code: z.string().regex(/^\d{8}$/) });
function requestId(params: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(params);
  if (!parsed.success) throw new ValidationError('Invalid sign-in request');
  return parsed.data.id;
}

export async function socialAuthRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma, signAccessToken: app.jwt.sign.bind(app.jwt) };
  app.addHook('onSend', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.post('/auth/requests', { preHandler: validateBody(startSchema), config: { rateLimit: { max: 5, timeWindow: 60_000 } } }, async (request) => {
    const input = startSchema.parse(request.body);
    return createSocialRequest(ctx, input.provider, input.locale);
  });
  app.post('/auth/requests/link', { preHandler: [authenticate, validateBody(startSchema)], config: { rateLimit: { max: 5, timeWindow: 60_000 } } }, async (request) => {
    const input = startSchema.parse(request.body);
    return createSocialRequest(ctx, input.provider, input.locale, request.currentUser!.id);
  });
  app.get('/auth/requests/:id', { config: { rateLimit: { max: 20, timeWindow: 60_000 } } }, async (request) => socialRequestInfo(ctx, requestId(request.params)));
  app.post('/auth/requests/:id/google', { preHandler: validateBody(googleSchema), config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request) => {
    return approveGoogleRequest(ctx, requestId(request.params), googleSchema.parse(request.body).idToken);
  });
  app.post('/auth/requests/:id/exchange', { preHandler: validateBody(exchangeSchema), config: { rateLimit: { max: 10, timeWindow: 60_000 } } }, async (request) => {
    const input = exchangeSchema.parse(request.body);
    return exchangeSocialRequest(ctx, requestId(request.params), input.requestSecret, input.code,
      { userAgent: request.headers['user-agent'], ipAddress: request.ip });
  });
}
