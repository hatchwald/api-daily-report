import { z } from 'zod';

export const connectionParamsSchema = z.object({ id: z.uuid() });

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      additionalProperties: true,
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;

export const connectionListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'provider',
          'baseUrl',
          'providerUsername',
          'installationId',
          'status',
          'createdAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          provider: { type: 'string', enum: ['github', 'gitlab'] },
          baseUrl: { type: 'string', format: 'uri' },
          providerUsername: { type: 'string' },
          installationId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          status: { type: 'string', enum: ['active', 'expired', 'revoked', 'error'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;

export const connectionIdParamsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export { errorResponseSchema as connectionErrorResponseSchema };
