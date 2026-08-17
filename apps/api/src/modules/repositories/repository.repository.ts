import type { PrismaClient } from '../../generated/prisma/client.js';
import type { GitRepository } from '../../providers/git-provider.interface.js';

import type { RepositoryPage } from './repository.types.js';

export interface RepositoryRepository {
  replaceAuthorized(connectionId: string, repositories: GitRepository[]): Promise<void>;
  listOwned(userId: string, page: number, limit: number): Promise<RepositoryPage>;
  setEnabledOwned(repositoryId: string, userId: string, enabled: boolean): Promise<boolean>;
  findEnabledOwned(connectionIds: string[], userId: string): Promise<EnabledRepository[]>;
}

export interface EnabledRepository {
  connectionId: string;
  externalId: string;
  fullName: string;
}

export class PrismaRepositoryRepository implements RepositoryRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async replaceAuthorized(
    connectionId: string,
    repositories: GitRepository[],
  ): Promise<void> {
    const externalIds = repositories.map((repository) => repository.externalId);
    await this.prisma.$transaction([
      ...repositories.map((repository) =>
        this.prisma.repository.upsert({
          where: {
            connectionId_externalId: { connectionId, externalId: repository.externalId },
          },
          create: {
            connectionId,
            externalId: repository.externalId,
            name: repository.name,
            fullName: repository.fullName,
            url: repository.url,
          },
          update: {
            name: repository.name,
            fullName: repository.fullName,
            url: repository.url,
          },
        }),
      ),
      this.prisma.repository.deleteMany({
        where: { connectionId, externalId: { notIn: externalIds } },
      }),
    ]);
  }

  public async listOwned(userId: string, page: number, limit: number): Promise<RepositoryPage> {
    const where = { connection: { userId } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.repository.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          connectionId: true,
          externalId: true,
          name: true,
          fullName: true,
          url: true,
          enabled: true,
          updatedAt: true,
          connection: { select: { provider: true } },
        },
      }),
      this.prisma.repository.count({ where }),
    ]);
    return {
      items: items.map(({ connection, ...repository }) => ({
        ...repository,
        provider: connection.provider === 'GITHUB' ? 'github' : 'gitlab',
      })),
      total,
      page,
      limit,
    };
  }

  public async setEnabledOwned(
    repositoryId: string,
    userId: string,
    enabled: boolean,
  ): Promise<boolean> {
    const result = await this.prisma.repository.updateMany({
      where: { id: repositoryId, connection: { userId } },
      data: { enabled },
    });
    return result.count === 1;
  }

  public async findEnabledOwned(
    connectionIds: string[],
    userId: string,
  ): Promise<EnabledRepository[]> {
    return this.prisma.repository.findMany({
      where: {
        connectionId: { in: connectionIds },
        enabled: true,
        connection: { userId },
      },
      select: { connectionId: true, externalId: true, fullName: true },
    });
  }
}
