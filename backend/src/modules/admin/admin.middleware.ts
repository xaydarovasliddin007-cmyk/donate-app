import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';
import { verifyAdminAccessToken } from './admin-token.js';

/** Verifies the request's Authorization header against the *admin* secret and requires scope="admin". */
export async function authenticateAdmin(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Admin authentication required');
  }

  const payload = await verifyAdminAccessToken(header.slice('Bearer '.length)).catch(() => null);
  if (!payload || payload.scope !== 'admin') {
    throw new UnauthorizedError('Invalid or expired admin session');
  }
  request.currentAdmin = { id: payload.sub, role: payload.role };
}

/** Restricts a route to specific admin roles. Must run after {@link authenticateAdmin}. */
export function requireAdminRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.currentAdmin || !allowedRoles.includes(request.currentAdmin.role)) {
      throw new ForbiddenError('Your admin role does not permit this action');
    }
  };
}
