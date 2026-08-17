import type { FastifyRequest } from 'fastify';

import { ApplicationError } from '../shared/errors/application-error.js';

export function requireAuthenticatedUserId(request: FastifyRequest): string {
  const { userId } = request.session;
  if (!userId) {
    throw new ApplicationError('UNAUTHORIZED', 'Authentication is required.', 401);
  }

  return userId;
}
