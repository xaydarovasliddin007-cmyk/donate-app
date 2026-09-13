import type { FastifyInstance } from 'fastify';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import {
  googleAuthSchema,
  guestAuthSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshSchema,
  registerCompleteSchema,
  registerRequestCodeSchema,
  verifyEmailSchema,
} from './auth.schemas.js';
import * as authService from './auth.service.js';
import type {
  GoogleAuthInput,
  GuestAuthInput,
  LoginInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  RefreshInput,
  RegisterCompleteInput,
  RegisterRequestCodeInput,
  VerifyEmailInput,
} from './auth.schemas.js';

export async function authRoutes(app: FastifyInstance) {
  const ctx = { prisma: app.prisma, signAccessToken: app.jwt.sign.bind(app.jwt) };

  app.post(
    '/auth/register/request-code',
    { preHandler: validateBody(registerRequestCodeSchema) },
    async (request, reply) => {
      const body = request.body as RegisterRequestCodeInput;
      await authService.requestRegistration(ctx, body);
      return reply.status(204).send();
    },
  );

  app.post(
    '/auth/register/complete',
    {
      // Guards the 6-digit email code from brute-forcing within its TTL.
      config: { rateLimit: { max: 8, timeWindow: 60_000 } },
      preHandler: validateBody(registerCompleteSchema),
    },
    async (request, reply) => {
      const body = request.body as RegisterCompleteInput;
      const result = await authService.completeRegistration(ctx, body, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/auth/login',
    {
      // Tighter than the global default — customer accounts hold real wallet
      // balances, so login is a brute-force target just like admin login.
      config: { rateLimit: { max: 10, timeWindow: 60_000 } },
      preHandler: validateBody(loginSchema),
    },
    async (request) => {
      const body = request.body as LoginInput;
      return authService.login(ctx, body, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
    },
  );

  app.post(
    '/auth/password/reset-request',
    {
      // A tighter cap than the global default — this sends an email per
      // call, so it's the cheapest endpoint in the API to abuse for spam.
      config: { rateLimit: { max: 5, timeWindow: 60_000 } },
      preHandler: validateBody(passwordResetRequestSchema),
    },
    async (request, reply) => {
      const body = request.body as PasswordResetRequestInput;
      await authService.requestPasswordReset(ctx, body);
      return reply.status(204).send();
    },
  );

  app.post(
    '/auth/password/reset',
    { preHandler: validateBody(passwordResetSchema) },
    async (request) => {
      const body = request.body as PasswordResetInput;
      return authService.resetPassword(ctx, body, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
    },
  );

  app.post('/auth/google', { preHandler: validateBody(googleAuthSchema) }, async (request) => {
    const body = request.body as GoogleAuthInput;
    return authService.googleAuth(ctx, body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  });

  app.post('/auth/guest', { preHandler: validateBody(guestAuthSchema) }, async (request) => {
    const body = request.body as GuestAuthInput;
    return authService.guestAuth(ctx, body, {
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

  app.post(
    '/auth/verify-email',
    {
      // Guards the 6-digit email code from brute-forcing within its TTL.
      config: { rateLimit: { max: 8, timeWindow: 60_000 } },
      preHandler: [authenticate, validateBody(verifyEmailSchema)],
    },
    async (request, reply) => {
      const body = request.body as VerifyEmailInput;
      await authService.verifyEmail(ctx, request.currentUser!.id, body.code);
      return reply.status(204).send();
    },
  );

  app.post('/auth/resend-verification', { preHandler: authenticate }, async (request, reply) => {
    await authService.resendVerificationEmail(ctx, request.currentUser!.id);
    return reply.status(204).send();
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.currentUser!.id } });
    return authService.toPublicUser(user);
  });

  app.get('/auth/sessions', { preHandler: authenticate }, async (request) => {
    const sessions = await authService.listSessions(ctx, request.currentUser!.id, request.currentUser!.sid);
    return { sessions };
  });

  app.delete<{ Params: { id: string } }>(
    '/auth/sessions/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      await authService.revokeSession(ctx, request.currentUser!.id, request.params.id);
      return reply.status(204).send();
    },
  );

  app.post('/auth/logout-all', { preHandler: authenticate }, async (request, reply) => {
    await authService.revokeAllSessions(ctx, request.currentUser!.id);
    return reply.status(204).send();
  });

  app.post('/auth/account/delete-request', { preHandler: authenticate }, async (request, reply) => {
    await authService.requestAccountDeletion(ctx, request.currentUser!.id);
    return reply.status(204).send();
  });
}
