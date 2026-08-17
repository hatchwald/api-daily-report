import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../../plugins/auth.js';

import {
  connectionErrorResponseSchema,
  connectionIdParamsJsonSchema,
  connectionListResponseSchema,
  connectionParamsSchema,
} from './connection.schema.js';
import type { ConnectionService } from './connection.service.js';

export interface ConnectionRoutesOptions {
  connectionService: ConnectionService;
}

export function connectionRoutes(app: FastifyInstance, options: ConnectionRoutesOptions): void {
  app.get(
    '/',
    {
      schema: {
        tags: ['Connections'],
        summary: 'List Git connections',
        description: 'Lists only connections owned by the authenticated user.',
        response: {
          200: connectionListResponseSchema,
          401: connectionErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = requireAuthenticatedUserId(request);
      const connections = await options.connectionService.list(userId);
      return { success: true, data: connections };
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Disconnect a Git provider',
        description: 'Deletes a connection only when it belongs to the authenticated user.',
        params: connectionIdParamsJsonSchema,
        response: {
          204: { type: 'null', description: 'Connection removed' },
          400: connectionErrorResponseSchema,
          401: connectionErrorResponseSchema,
          404: connectionErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuthenticatedUserId(request);
      const { id } = connectionParamsSchema.parse(request.params);
      await options.connectionService.disconnect(id, userId);
      return reply.status(204).send();
    },
  );
}
