import { z } from 'zod';

export const generateReportBodySchema = z.object({
  date: z.iso.date(),
  connectionIds: z.array(z.uuid()).min(1).max(20),
});

export const reportErrorResponseSchema = {
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

export const generatedReportResponseSchema = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      required: [
        'id',
        'reportDate',
        'summary',
        'totalCommits',
        'totalMergeRequests',
        'totalReviews',
        'generatedAt',
        'items',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        reportDate: { type: 'string', format: 'date' },
        summary: { type: 'string' },
        totalCommits: { type: 'integer' },
        totalMergeRequests: { type: 'integer' },
        totalReviews: { type: 'integer' },
        generatedAt: { type: 'string', format: 'date-time' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'provider',
              'repositoryName',
              'category',
              'title',
              'description',
              'activityCount',
              'sourceData',
            ],
            properties: {
              provider: { type: 'string', enum: ['github', 'gitlab'] },
              repositoryName: { type: 'string' },
              category: { type: 'string', enum: ['commit', 'merge_request', 'review'] },
              title: { type: 'string' },
              description: { type: 'string' },
              activityCount: { type: 'integer' },
              sourceData: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['category', 'externalId', 'title', 'url'],
                  properties: {
                    category: { type: 'string', enum: ['commit', 'merge_request', 'review'] },
                    externalId: { type: 'string' },
                    title: { type: 'string' },
                    url: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
