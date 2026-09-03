import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../lib/errors.js';

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string; sid?: string }>();
    request.currentUser = { id: payload.sub, role: payload.role, sid: payload.sid };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

/**
 * Same as authenticate(), but for routes that must stay browsable without
 * logging in (the public catalog) while still wanting to personalize the
 * response — per-user discount pricing, currently the only case — for
 * whoever happens to already be signed in. A missing or invalid token is
 * silently treated as "anonymous visitor," never an error.
 */
export async function tryAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: string; sid?: string }>();
    request.currentUser = { id: payload.sub, role: payload.role, sid: payload.sid };
  } catch {
    // No token, or an expired/invalid one — proceed as an anonymous visitor.
  }
}
