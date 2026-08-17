import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../../plugins/auth.js';

import {
  repositoryErrorResponseSchema,
  repositoryListQuerySchema,
  repositoryListResponseSchema,
  repositoryParamsSchema,
  synchronizeRepositoriesBodySchema,
  updateRepositoryBodySchema,
} from './repository.schema.js';
import type { RepositoryService } from './repository.service.js';

export interface RepositoryRoutesOptions {
  repositoryService: RepositoryService;
}

export function repositoryRoutes(app: FastifyInstance, options: RepositoryRoutesOptions): void {
  app.get(
    '/',
    {
      schema: {
        tags: ['Repositories'],
        summary: 'List synchronized repositories',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: { 200: repositoryListResponseSchema, 401: repositoryErrorResponseSchema },
      },
    },
    async (request) => {
      const userId = requireAuthenticatedUserId(request);
      const { page, limit } = repositoryListQuerySchema.parse(request.query);
      const result = await options.repositoryService.list(userId, page, limit);
      return {
        success: true,
        data: result.items,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    },
  );

  app.post(
    '/sync',
    {
      schema: {
        tags: ['Repositories'],
        summary: 'Synchronize authorized repositories',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['connectionIds'],
          properties: {
            connectionIds: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                required: ['repositoryCount'],
                properties: { repositoryCount: { type: 'integer' } },
              },
            },
          },
          400: repositoryErrorResponseSchema,
          401: repositoryErrorResponseSchema,
          403: repositoryErrorResponseSchema,
          502: repositoryErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = requireAuthenticatedUserId(request);
      const { connectionIds } = synchronizeRepositoriesBodySchema.parse(request.body);
      const repositoryCount = await options.repositoryService.synchronize(userId, connectionIds);
      return { success: true, data: { repositoryCount } };
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['Repositories'],
        summary: 'Enable or disable a repository',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['enabled'],
          properties: { enabled: { type: 'boolean' } },
        },
        response: {
          204: { type: 'null', description: 'Repository selection updated' },
          400: repositoryErrorResponseSchema,
          401: repositoryErrorResponseSchema,
          404: repositoryErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuthenticatedUserId(request);
      const { id } = repositoryParamsSchema.parse(request.params);
      const { enabled } = updateRepositoryBodySchema.parse(request.body);
      await options.repositoryService.setEnabled(id, userId, enabled);
      return reply.status(204).send();
    },
  );
}
