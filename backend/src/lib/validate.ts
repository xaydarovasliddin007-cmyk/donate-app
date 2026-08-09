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
