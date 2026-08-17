import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { ApplicationError } from '../shared/errors/application-error.js';

function getClientStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return null;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : null;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request.', details: error.issues },
      });
    }

    if (error instanceof ApplicationError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    const clientStatusCode = getClientStatusCode(error);
    if (clientStatusCode) {
      const code = clientStatusCode === 429 ? 'RATE_LIMITED' : 'VALIDATION_ERROR';
      return reply.status(clientStatusCode).send({
        success: false,
        error: {
          code,
          message: clientStatusCode === 429 ? 'Too many requests.' : 'Invalid request.',
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  });
}
