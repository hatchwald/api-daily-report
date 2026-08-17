import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { Environment } from '../../config/env.js';

import type { UserRepository } from './auth.repository.js';
import type { CreateUserInput, StoredUser } from './auth.types.js';

class MemoryUserRepository implements UserRepository {
  private readonly users: StoredUser[] = [];

  public findByEmail(email: string): Promise<StoredUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  public create(input: CreateUserInput): Promise<StoredUser> {
    const user = { id: crypto.randomUUID(), ...input };
    this.users.push(user);
    return Promise.resolve(user);
  }
}

const environment: Environment = {
  NODE_ENV: 'test',
  PORT: 3000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/api_daily_report_test',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  FRONTEND_URL: 'http://localhost:5173',
  REQUEST_TIMEOUT_MS: 30_000,
  PROVIDER_REQUEST_TIMEOUT_MS: 15_000,
};

const openApps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...openApps].map(async (app) => app.close()));
  openApps.clear();
});

async function createApp(): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const app = await buildApp(environment, { userRepository: new MemoryUserRepository() });
  openApps.add(app);
  return app;
}

describe('authentication routes', () => {
  it('registers a user and starts a session', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'Developer@Example.com',
        password: 'a-secure-password',
        name: 'Developer',
        timezone: 'Asia/Jakarta',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      success: true,
      data: { user: { email: 'developer@example.com', timezone: 'Asia/Jakarta' } },
    });
    expect(response.headers['set-cookie']).toContain('daily_report_session=');
    expect(response.body).not.toContain('password');
  });

  it('rejects a password shorter than twelve characters', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'developer@example.com', password: 'too-short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects an invalid timezone', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'developer@example.com',
        password: 'a-secure-password',
        timezone: 'Invalid/Timezone',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('logs in with valid credentials and rejects invalid credentials', async () => {
    const app = await createApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'developer@example.com', password: 'a-secure-password' },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'developer@example.com', password: 'a-secure-password' },
    });
    const rejectedLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'developer@example.com', password: 'wrong' },
    });

    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('daily_report_session=');
    expect(rejectedLogin.statusCode).toBe(401);
  });

  it('ends the session during logout', async () => {
    const app = await createApp();

    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });

    expect(response.statusCode).toBe(204);
  });

  it('documents all authentication endpoints in OpenAPI', async () => {
    const app = await createApp();
    await app.ready();

    expect(app.swagger().paths).toMatchObject({
      '/api/v1/auth/register': {},
      '/api/v1/auth/login': {},
      '/api/v1/auth/logout': {},
    });
  });
});
