import { describe, expect, it } from 'vitest';

import type { GitRepository } from '../../providers/git-provider.interface.js';
import type { RepositoryProviderClient } from '../../providers/repository-provider.client.js';
import { CredentialEncryption } from '../../shared/security/credential-encryption.js';
import type {
  AuthorizedConnectionInput,
  ConnectionRepository,
  SyncConnection,
} from '../connections/connection.repository.js';
import type { ConnectionSummary } from '../connections/connection.types.js';

import type { RepositoryRepository } from './repository.repository.js';
import { RepositoryService } from './repository.service.js';
import type { RepositoryPage } from './repository.types.js';

class ConnectionFixture implements ConnectionRepository {
  public connections: SyncConnection[] = [];
  public findAllOwnedByUser(): Promise<ConnectionSummary[]> {
    return Promise.resolve([]);
  }
  public deleteOwnedByUser(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public upsertAuthorized(_input: AuthorizedConnectionInput): Promise<ConnectionSummary> {
    throw new Error('Not used by repository tests.');
  }
  public findOwnedForRepositorySync(): Promise<SyncConnection[]> {
    return Promise.resolve(this.connections);
  }
}

class RepositoryFixture implements RepositoryRepository {
  public replacements: { connectionId: string; repositories: GitRepository[] }[] = [];
  public updateResult = true;
  public replaceAuthorized(connectionId: string, repositories: GitRepository[]): Promise<void> {
    this.replacements.push({ connectionId, repositories });
    return Promise.resolve();
  }
  public listOwned(_userId: string, page: number, limit: number): Promise<RepositoryPage> {
    return Promise.resolve({ items: [], total: 0, page, limit });
  }
  public setEnabledOwned(): Promise<boolean> {
    return Promise.resolve(this.updateResult);
  }
}

class ProviderFixture implements RepositoryProviderClient {
  public gitlabToken: string | null = null;
  public repositories: GitRepository[] = [
    {
      provider: 'github',
      externalId: '1',
      name: 'api',
      fullName: 'owner/api',
      url: null,
    },
  ];
  public getGitHubRepositories(): Promise<GitRepository[]> {
    return Promise.resolve(this.repositories);
  }
  public getGitLabRepositories(_baseUrl: string, accessToken: string): Promise<GitRepository[]> {
    this.gitlabToken = accessToken;
    return Promise.resolve(
      this.repositories.map((repository) => ({ ...repository, provider: 'gitlab' })),
    );
  }
}

const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createService(): {
  service: RepositoryService;
  connections: ConnectionFixture;
  repositories: RepositoryFixture;
  provider: ProviderFixture;
  encryption: CredentialEncryption;
} {
  const connections = new ConnectionFixture();
  const repositories = new RepositoryFixture();
  const provider = new ProviderFixture();
  const encryption = new CredentialEncryption(key);
  return {
    service: new RepositoryService(connections, repositories, provider, encryption),
    connections,
    repositories,
    provider,
    encryption,
  };
}

describe('RepositoryService', () => {
  it('rejects synchronization when any connection is not owned and active', async () => {
    const { service } = createService();

    await expect(service.synchronize('user-1', ['connection-1'])).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('synchronizes GitHub repositories through an installation', async () => {
    const { service, connections, repositories } = createService();
    connections.connections = [
      {
        id: 'connection-1',
        provider: 'github',
        baseUrl: 'https://api.github.com',
        accessTokenEncrypted: null,
        installationId: '123',
      },
    ];

    const count = await service.synchronize('user-1', ['connection-1']);

    expect(count).toBe(1);
    expect(repositories.replacements[0]).toMatchObject({ connectionId: 'connection-1' });
  });

  it('decrypts GitLab credentials only when calling the provider', async () => {
    const { service, connections, provider, encryption } = createService();
    connections.connections = [
      {
        id: 'connection-1',
        provider: 'gitlab',
        baseUrl: 'https://gitlab.com',
        accessTokenEncrypted: encryption.encrypt('provider-token'),
        installationId: null,
      },
    ];

    await service.synchronize('user-1', ['connection-1']);

    expect(provider.gitlabToken).toBe('provider-token');
  });

  it('returns not found when updating a repository outside user ownership', async () => {
    const { service, repositories } = createService();
    repositories.updateResult = false;

    await expect(service.setEnabled('repository-1', 'user-1', false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
