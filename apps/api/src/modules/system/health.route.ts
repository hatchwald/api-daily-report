import type { FastifyInstance } from 'fastify';

const healthResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ok'] } },
    },
  },
} as const;

export function healthRoutes(app: FastifyInstance): void {
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Check API health',
        description: 'Returns a minimal status without exposing infrastructure details.',
        response: { 200: healthResponseSchema },
      },
    },
    () => ({ success: true, data: { status: 'ok' } }),
  );
}
