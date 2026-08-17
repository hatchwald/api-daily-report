import { describe, expect, it } from 'vitest';

import type {
  GitLabAuthorizationResult,
  ProviderAuthorizationClient,
  ProviderIdentity,
} from '../../providers/provider-authorization.client.js';
import { CredentialEncryption } from '../../shared/security/credential-encryption.js';

import { ConnectionAuthorizationService } from './connection-auth.service.js';
import type {
  AuthorizedConnectionInput,
  ConnectionRepository,
  SyncConnection,
} from './connection.repository.js';
import type { ConnectionSummary } from './connection.types.js';

class MemoryConnectionRepository implements ConnectionRepository {
  public lastAuthorizedInput: AuthorizedConnectionInput | null = null;

  public findAllOwnedByUser(): Promise<ConnectionSummary[]> {
    return Promise.resolve([]);
  }

  public deleteOwnedByUser(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public upsertAuthorized(input: AuthorizedConnectionInput): Promise<ConnectionSummary> {
    this.lastAuthorizedInput = input;
    return Promise.resolve({
      id: '4e8e2170-e29b-4fc4-a501-42a6c8d9e100',
      provider: input.provider,
      baseUrl: input.baseUrl,
      providerUsername: input.providerUsername,
      installationId: input.installationId,
      status: 'active',
      createdAt: new Date('2026-08-17T00:00:00.000Z'),
    });
  }

  public findOwnedForRepositorySync(): Promise<SyncConnection[]> {
    return Promise.resolve([]);
  }
}

class FakeAuthorizationClient implements ProviderAuthorizationClient {
  public githubCalls = 0;
  public gitlabCalls = 0;
  public githubIdentity: ProviderIdentity = { externalId: '42', username: 'octocat' };
  public gitlabAuthorization: GitLabAuthorizationResult = {
    externalId: '84',
    username: 'gitlab-user',
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    expiresAt: new Date('2026-08-17T01:00:00.000Z'),
  };

  public verifyGitHubInstallation(): Promise<ProviderIdentity> {
    this.githubCalls += 1;
    return Promise.resolve(this.githubIdentity);
  }

  public exchangeGitLabCode(): Promise<GitLabAuthorizationResult> {
    this.gitlabCalls += 1;
    return Promise.resolve(this.gitlabAuthorization);
  }
}

function createService(): {
  service: ConnectionAuthorizationService;
  connections: MemoryConnectionRepository;
  client: FakeAuthorizationClient;
  encryption: CredentialEncryption;
} {
  const connections = new MemoryConnectionRepository();
  const client = new FakeAuthorizationClient();
  const encryption = new CredentialEncryption(
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  );
  const service = new ConnectionAuthorizationService(connections, client, encryption, {
    githubAppSlug: 'daily-report',
    gitlabClientId: 'client-id',
    gitlabRedirectUri: 'https://api.example.com/api/v1/connections/gitlab/callback',
    gitlabAllowedBaseUrls: ['https://gitlab.com', 'https://gitlab.example.com'],
  });
  return { service, connections, client, encryption };
}

describe('ConnectionAuthorizationService', () => {
  it('creates a GitHub App installation URL with unpredictable state', () => {
    const { service } = createService();

    const first = service.beginGitHubInstallation();
    const second = service.beginGitHubInstallation();

    expect(first.authorizationUrl).toContain('github.com/apps/daily-report/installations/new');
    expect(first.authorizationUrl).toContain(encodeURIComponent(first.state));
    expect(first.state).not.toBe(second.state);
  });

  it('verifies a GitHub installation before persisting it', async () => {
    const { service, connections, client } = createService();

    await service.completeGitHubInstallation({
      userId: 'user-1',
      installationId: '12345',
      state: 'expected-state',
      expectedState: 'expected-state',
    });

    expect(client.githubCalls).toBe(1);
    expect(connections.lastAuthorizedInput).toMatchObject({
      userId: 'user-1',
      provider: 'github',
      authType: 'github_app',
      installationId: '12345',
      accessTokenEncrypted: null,
    });
  });

  it('uses PKCE and read-only GitLab API scope for an allowed self-hosted instance', () => {
    const { service } = createService();

    const authorization = service.beginGitLabAuthorization('https://gitlab.example.com');
    const url = new URL(authorization.authorizationUrl);

    expect(url.origin).toBe('https://gitlab.example.com');
    expect(url.searchParams.get('scope')).toBe('read_api');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).not.toBe(authorization.codeVerifier);
  });

  it('rejects GitLab instances outside the configured allowlist', () => {
    const { service } = createService();

    expect(() => service.beginGitLabAuthorization('https://untrusted.example.com')).toThrow(
      expect.objectContaining({ code: 'GIT_PROVIDER_UNAVAILABLE', statusCode: 422 }),
    );
  });

  it('rejects invalid OAuth state before contacting a provider', async () => {
    const { service, client } = createService();

    const callback = service.completeGitLabAuthorization({
      userId: 'user-1',
      code: 'authorization-code',
      state: 'wrong-state',
      pending: {
        state: 'expected-state',
        codeVerifier: 'verifier',
        baseUrl: 'https://gitlab.com',
      },
    });

    await expect(callback).rejects.toMatchObject({ code: 'OAUTH_STATE_INVALID' });
    expect(client.gitlabCalls).toBe(0);
  });

  it('encrypts GitLab tokens before persistence', async () => {
    const { service, connections, encryption } = createService();

    await service.completeGitLabAuthorization({
      userId: 'user-1',
      code: 'authorization-code',
      state: 'expected-state',
      pending: {
        state: 'expected-state',
        codeVerifier: 'verifier',
        baseUrl: 'https://gitlab.com',
      },
    });

    const encryptedAccessToken = connections.lastAuthorizedInput?.accessTokenEncrypted;
    const encryptedRefreshToken = connections.lastAuthorizedInput?.refreshTokenEncrypted;
    expect(encryptedAccessToken).not.toBe('access-secret');
    expect(encryptedRefreshToken).not.toBe('refresh-secret');
    expect(encryption.decrypt(encryptedAccessToken ?? '')).toBe('access-secret');
    expect(encryption.decrypt(encryptedRefreshToken ?? '')).toBe('refresh-secret');
  });
});
