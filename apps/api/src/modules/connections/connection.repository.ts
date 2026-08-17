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
}
