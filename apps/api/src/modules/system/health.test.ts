import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { Environment } from '../../config/env.js';

const testEnvironment: Environment = {
  NODE_ENV: 'test',
  PORT: 3000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/api_daily_report_test',
  FRONTEND_URL: 'http://localhost:5173',
  REQUEST_TIMEOUT_MS: 30_000,
  PROVIDER_REQUEST_TIMEOUT_MS: 15_000,
};

const openApps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...openApps].map(async (app) => app.close()));
  openApps.clear();
});

describe('GET /api/v1/health', () => {
  it('returns a minimal healthy response', async () => {
    const app = await buildApp(testEnvironment);
    openApps.add(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('is included in the generated OpenAPI document', async () => {
    const app = await buildApp(testEnvironment);
    openApps.add(app);
    await app.ready();

    expect(app.swagger().paths).toHaveProperty('/api/v1/health');
  });
});
