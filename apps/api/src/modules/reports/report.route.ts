import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../../plugins/auth.js';

import {
  generateReportBodySchema,
  generatedReportResponseSchema,
  reportErrorResponseSchema,
} from './report.schema.js';
import type { ReportService } from './report.service.js';

export interface ReportRoutesOptions {
  reportService: ReportService;
}

export function reportRoutes(app: FastifyInstance, options: ReportRoutesOptions): void {
  app.post(
    '/generate',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.session.userId ?? request.ip,
        },
      },
      schema: {
        tags: ['Reports'],
        summary: 'Generate or regenerate a daily report',
        description: 'Synchronously generates one current report for the user and date.',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['date', 'connectionIds'],
          properties: {
            date: { type: 'string', format: 'date' },
            connectionIds: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          200: generatedReportResponseSchema,
          400: reportErrorResponseSchema,
          401: reportErrorResponseSchema,
          403: reportErrorResponseSchema,
          409: reportErrorResponseSchema,
          429: reportErrorResponseSchema,
          502: reportErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = requireAuthenticatedUserId(request);
      const body = generateReportBodySchema.parse(request.body);
      const report = await options.reportService.generate({
        userId,
        reportDate: body.date,
        connectionIds: body.connectionIds,
      });
      return { success: true, data: report };
    },
  );
}
