import type { FastifyInstance } from 'fastify';

import {
  authBodyJsonSchema,
  authUserResponseSchema,
  errorResponseSchema,
  loginBodySchema,
  registerBodySchema,
} from './auth.schema.js';
import type { AuthService } from './auth.service.js';
import { destroySession, regenerateSession } from './session.js';

export interface AuthRoutesOptions {
  authService: AuthService;
}

export function authRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  app.post(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Register an account',
        body: {
          ...authBodyJsonSchema,
          properties: {
            ...authBodyJsonSchema.properties,
            password: { type: 'string', minLength: 12, maxLength: 128 },
          },
        },
        response: {
          201: authUserResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const input = registerBodySchema.parse(request.body);
      const user = await options.authService.register(input);
      await regenerateSession(request.session);
      request.session.userId = user.id;
      return reply.status(201).send({ success: true, data: { user } });
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Sign in',
        body: authBodyJsonSchema,
        response: {
          200: authUserResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const input = loginBodySchema.parse(request.body);
      const user = await options.authService.login(input);
      await regenerateSession(request.session);
      request.session.userId = user.id;
      return { success: true, data: { user } };
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Sign out',
        response: { 204: { type: 'null', description: 'Session ended' } },
      },
    },
    async (request, reply) => {
      await destroySession(request.session);
      return reply.status(204).send();
    },
  );
}
