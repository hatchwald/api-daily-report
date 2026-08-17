import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import type { Environment } from './config/env.js';
import { healthRoutes } from './modules/system/health.route.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerSwagger } from './plugins/swagger.js';

export async function buildApp(environment: Environment): Promise<FastifyInstance> {
  const app = Fastify({
    logger: environment.NODE_ENV !== 'test',
    requestTimeout: environment.REQUEST_TIMEOUT_MS,
    requestIdHeader: 'x-request-id',
  });

  await registerSwagger(app);
  await app.register(helmet);
  await app.register(cors, {
    origin: environment.FRONTEND_URL,
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  registerErrorHandler(app);
  await app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
