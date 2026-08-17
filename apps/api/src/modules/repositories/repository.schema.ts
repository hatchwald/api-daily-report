import { z } from 'zod';

export const repositoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const synchronizeRepositoriesBodySchema = z.object({
  connectionIds: z.array(z.uuid()).min(1).max(20),
});
export const repositoryParamsSchema = z.object({ id: z.uuid() });
export const updateRepositoryBodySchema = z.object({ enabled: z.boolean() });

export const repositoryErrorResponseSchema = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

export const repositoryListResponseSchema = {
  type: 'object',
  required: ['success', 'data', 'meta'],
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'connectionId',
          'provider',
          'externalId',
          'name',
          'fullName',
          'url',
          'enabled',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          connectionId: { type: 'string', format: 'uuid' },
          provider: { type: 'string', enum: ['github', 'gitlab'] },
          externalId: { type: 'string' },
          name: { type: 'string' },
          fullName: { type: 'string' },
          url: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
          enabled: { type: 'boolean' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    meta: {
      type: 'object',
      required: ['page', 'limit', 'total'],
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
      },
    },
  },
} as const;
