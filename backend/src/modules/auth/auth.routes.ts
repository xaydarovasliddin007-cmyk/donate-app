import type { FastifyInstance } from 'fastify';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { googleAuthSchema, loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import type { GoogleAuthInput, LoginInput, RefreshInput, RegisterInput } from './auth.schemas.js';

export async function authRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma, signAccessToken: app.jwt.sign.bind(app.jwt) };

  app.post('/auth/register', { preHandler: validateBody(registerSchema) }, async (request, reply) => {
    const body = request.body as RegisterInput;
    const result = await authService.register(ctx, body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
    return reply.status(201).send(result);
  });

  app.post('/auth/login', { preHandler: validateBody(loginSchema) }, async (request) => {
    const body = request.body as LoginInput;
    return authService.login(ctx, body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  });

  app.post('/auth/google', { preHandler: validateBody(googleAuthSchema) }, async (request) => {
    const body = request.body as GoogleAuthInput;
    return authService.googleAuth(ctx, body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  });

  app.post('/auth/refresh', { preHandler: validateBody(refreshSchema) }, async (request) => {
    const body = request.body as RefreshInput;
    return authService.refresh(ctx, body.refreshToken, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  });

  app.post('/auth/logout', { preHandler: validateBody(refreshSchema) }, async (request, reply) => {
    const body = request.body as RefreshInput;
    await authService.logout(ctx, body.refreshToken);
    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.id } });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      role: user.role,
    };
  });
}
