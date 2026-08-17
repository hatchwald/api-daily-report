import type { RepositoryProviderClient } from '../../providers/repository-provider.client.js';
import { ApplicationError } from '../../shared/errors/application-error.js';
import type { CredentialEncryption } from '../../shared/security/credential-encryption.js';
import type { ConnectionRepository, SyncConnection } from '../connections/connection.repository.js';

import type { RepositoryRepository } from './repository.repository.js';
import type { RepositoryPage } from './repository.types.js';

export class RepositoryService {
  public constructor(
    private readonly connections: ConnectionRepository,
    private readonly repositories: RepositoryRepository,
    private readonly providerClient: RepositoryProviderClient,
    private readonly encryption: CredentialEncryption,
  ) {}

  public list(userId: string, page: number, limit: number): Promise<RepositoryPage> {
    return this.repositories.listOwned(userId, page, limit);
  }

  public async synchronize(userId: string, connectionIds: string[]): Promise<number> {
    const uniqueConnectionIds = [...new Set(connectionIds)];
    const connections = await this.connections.findOwnedForRepositorySync(
      uniqueConnectionIds,
      userId,
    );
    if (connections.length !== uniqueConnectionIds.length) {
      throw new ApplicationError('FORBIDDEN', 'One or more Git connections are unavailable.', 403);
    }

    const counts = await Promise.all(
      connections.map(async (connection) => this.synchronizeConnection(connection)),
    );
    return counts.reduce((total, count) => total + count, 0);
  }

  public async setEnabled(repositoryId: string, userId: string, enabled: boolean): Promise<void> {
    const updated = await this.repositories.setEnabledOwned(repositoryId, userId, enabled);
    if (!updated) throw new ApplicationError('NOT_FOUND', 'Repository was not found.', 404);
  }

  private async synchronizeConnection(connection: SyncConnection): Promise<number> {
    let repositories;
    if (connection.provider === 'github') {
      if (!connection.installationId) {
        throw new ApplicationError('GIT_AUTH_EXPIRED', 'GitHub installation is unavailable.', 401);
      }
      repositories = await this.providerClient.getGitHubRepositories(connection.installationId);
    } else {
      if (!connection.accessTokenEncrypted) {
        throw new ApplicationError('GIT_AUTH_EXPIRED', 'GitLab authorization is unavailable.', 401);
      }
      repositories = await this.providerClient.getGitLabRepositories(
        connection.baseUrl,
        this.encryption.decrypt(connection.accessTokenEncrypted),
      );
    }
    await this.repositories.replaceAuthorized(connection.id, repositories);
    return repositories.length;
  }
}
