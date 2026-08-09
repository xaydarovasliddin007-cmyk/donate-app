import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../lib/errors.js';

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string }>();
    request.currentUser = { id: payload.sub, role: payload.role };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
