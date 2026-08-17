import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { Environment } from '../../config/env.js';
import type { UserRepository } from '../auth/auth.repository.js';
import type { CreateUserInput, StoredUser } from '../auth/auth.types.js';

import type { ConnectionRepository, SyncConnection } from './connection.repository.js';
import type { ConnectionSummary } from './connection.types.js';

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

class MemoryConnectionRepository implements ConnectionRepository {
  public lastListUserId: string | null = null;
  public lastDelete: { connectionId: string; userId: string } | null = null;
  public deleteResult = true;
  public connections: ConnectionSummary[] = [];
  public authorizedConnection: ConnectionSummary | null = null;

  public findAllOwnedByUser(userId: string): Promise<ConnectionSummary[]> {
    this.lastListUserId = userId;
    return Promise.resolve(this.connections);
  }

  public deleteOwnedByUser(connectionId: string, userId: string): Promise<boolean> {
    this.lastDelete = { connectionId, userId };
    return Promise.resolve(this.deleteResult);
  }

  public upsertAuthorized(): Promise<ConnectionSummary> {
    if (!this.authorizedConnection) throw new Error('No authorized connection fixture configured.');
    return Promise.resolve(this.authorizedConnection);
  }

  public findOwnedForRepositorySync(): Promise<SyncConnection[]> {
    return Promise.resolve([]);
  }
}

const environment: Environment = {
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
  GITLAB_ALLOWED_BASE_URLS: ['https://gitlab.com', 'https://gitlab.example.com'],
};

const openApps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...openApps].map(async (app) => app.close()));
  openApps.clear();
});

async function createAuthenticatedApp(): Promise<{
  app: Awaited<ReturnType<typeof buildApp>>;
  connections: MemoryConnectionRepository;
  cookie: string;
}> {
  const connections = new MemoryConnectionRepository();
  const app = await buildApp(environment, {
    userRepository: new MemoryUserRepository(),
    connectionRepository: connections,
  });
  openApps.add(app);
  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'developer@example.com', password: 'a-secure-password' },
  });
  const cookieHeader = registration.headers['set-cookie'];
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  if (!cookie) throw new Error('Registration did not create a session cookie.');
  return { app, connections, cookie };
}

describe('connection routes', () => {
  it('rejects unauthenticated connection access', async () => {
    const connections = new MemoryConnectionRepository();
    const app = await buildApp(environment, {
      userRepository: new MemoryUserRepository(),
      connectionRepository: connections,
    });
    openApps.add(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/connections' });

    expect(response.statusCode).toBe(401);
    expect(connections.lastListUserId).toBeNull();
  });

  it('lists only through the authenticated user ownership query', async () => {
    const { app, connections, cookie } = await createAuthenticatedApp();
    connections.connections = [
      {
        id: crypto.randomUUID(),
        provider: 'gitlab',
        baseUrl: 'https://gitlab.example.com',
        providerUsername: 'developer',
        installationId: null,
        status: 'active',
        createdAt: new Date('2026-08-17T00:00:00.000Z'),
      },
    ];

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/connections',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(connections.lastListUserId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.json()).toMatchObject({
      success: true,
      data: [{ provider: 'gitlab', providerUsername: 'developer' }],
    });
    expect(response.body).not.toContain('Token');
  });

  it('disconnects using both the connection and authenticated user identifiers', async () => {
    const { app, connections, cookie } = await createAuthenticatedApp();
    const connectionId = crypto.randomUUID();

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/connections/${connectionId}`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(connections.lastDelete).toMatchObject({ connectionId });
    expect(connections.lastDelete?.userId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns not found without revealing connection ownership', async () => {
    const { app, connections, cookie } = await createAuthenticatedApp();
    connections.deleteResult = false;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/connections/${crypto.randomUUID()}`,
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});
