import type { PrismaClient } from '../../generated/prisma/client.js';

import type { ConnectionSummary, ConnectionStatus } from './connection.types.js';

function mapProvider(provider: 'GITHUB' | 'GITLAB'): ConnectionSummary['provider'] {
  return provider === 'GITHUB' ? 'github' : 'gitlab';
}

function mapStatus(status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR'): ConnectionStatus {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'EXPIRED':
      return 'expired';
    case 'REVOKED':
      return 'revoked';
    case 'ERROR':
      return 'error';
  }
}

export interface ConnectionRepository {
  findAllOwnedByUser(userId: string): Promise<ConnectionSummary[]>;
  deleteOwnedByUser(connectionId: string, userId: string): Promise<boolean>;
  upsertAuthorized(input: AuthorizedConnectionInput): Promise<ConnectionSummary>;
  findOwnedForRepositorySync(connectionIds: string[], userId: string): Promise<SyncConnection[]>;
}

export interface SyncConnection {
  id: string;
  provider: 'github' | 'gitlab';
  baseUrl: string;
  accessTokenEncrypted: string | null;
  installationId: string | null;
  providerUserId: string;
  providerUsername: string;
}

export interface AuthorizedConnectionInput {
  userId: string;
  provider: 'github' | 'gitlab';
  baseUrl: string;
  providerUserId: string;
  providerUsername: string;
  authType: 'github_app' | 'oauth2';
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  installationId: string | null;
}

export class PrismaConnectionRepository implements ConnectionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findAllOwnedByUser(userId: string): Promise<ConnectionSummary[]> {
    const connections = await this.prisma.gitConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        providerUsername: true,
        installationId: true,
        status: true,
        createdAt: true,
      },
    });

    return connections.map((connection) => ({
      ...connection,
      provider: mapProvider(connection.provider),
      status: mapStatus(connection.status),
    }));
  }

  public async deleteOwnedByUser(connectionId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.gitConnection.deleteMany({
      where: { id: connectionId, userId },
    });
    return result.count === 1;
  }

  public async upsertAuthorized(input: AuthorizedConnectionInput): Promise<ConnectionSummary> {
    const provider = input.provider === 'github' ? 'GITHUB' : 'GITLAB';
    const authType = input.authType === 'github_app' ? 'GITHUB_APP' : 'OAUTH2';
    const connection = await this.prisma.gitConnection.upsert({
      where: {
        userId_provider_baseUrl_providerUserId: {
          userId: input.userId,
          provider,
          baseUrl: input.baseUrl,
          providerUserId: input.providerUserId,
        },
      },
      create: {
        ...input,
        provider,
        authType,
        status: 'ACTIVE',
      },
      update: {
        providerUsername: input.providerUsername,
        authType,
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        tokenExpiresAt: input.tokenExpiresAt,
        installationId: input.installationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        providerUsername: true,
        installationId: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ...connection,
      provider: mapProvider(connection.provider),
      status: mapStatus(connection.status),
    };
  }

  public async findOwnedForRepositorySync(
    connectionIds: string[],
    userId: string,
  ): Promise<SyncConnection[]> {
    const connections = await this.prisma.gitConnection.findMany({
      where: { id: { in: connectionIds }, userId, status: 'ACTIVE' },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        accessTokenEncrypted: true,
        installationId: true,
        providerUserId: true,
        providerUsername: true,
      },
    });
    return connections.map((connection) => ({
      ...connection,
      provider: mapProvider(connection.provider),
    }));
  }
}
