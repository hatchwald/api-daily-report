import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Developer Daily Report API',
        description: 'Read-only Git activity reporting API.',
        version: '0.1.0',
      },
      tags: [
        { name: 'Auth', description: 'Registration and session authentication' },
        { name: 'Connections', description: 'Read-only Git provider connections' },
        { name: 'Repositories', description: 'Repository synchronization and selection' },
        { name: 'System', description: 'API status and diagnostics' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });
}
