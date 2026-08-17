import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { Environment } from '../../config/env.js';

const testEnvironment: Environment = {
  NODE_ENV: 'test',
  PORT: 3000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/api_daily_report_test',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  CREDENTIAL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  FRONTEND_URL: 'http://localhost:5173',
  REQUEST_TIMEOUT_MS: 30_000,
  PROVIDER_REQUEST_TIMEOUT_MS: 15_000,
  GITHUB_APP_ID: '12345',
  GITHUB_APP_SLUG: 'daily-report-test',
  GITHUB_PRIVATE_KEY: 'test-private-key',
  GITLAB_CLIENT_ID: 'gitlab-test-client',
  GITLAB_CLIENT_SECRET: 'gitlab-test-secret',
  GITLAB_REDIRECT_URI: 'http://localhost:3000/api/v1/connections/gitlab/callback',
  GITLAB_ALLOWED_BASE_URLS: ['https://gitlab.com'],
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
