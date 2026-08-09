import type { preHandlerHookHandler } from 'fastify';
import type { ZodType } from 'zod';
import { ValidationError } from './errors.js';

/** Parses and replaces `request.body` with the validated/coerced value, or throws ValidationError. */
export function validateBody(schema: ZodType): preHandlerHookHandler {
  return async (request) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten());
    }
    request.body = result.data;
  };
}

/** Parses and replaces `request.query` with the validated/coerced value, or throws ValidationError. */
export function validateQuery(schema: ZodType): preHandlerHookHandler {
  return async (request) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten());
    }
    request.query = result.data;
  };
}
