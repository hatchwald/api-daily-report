import { describe, expect, it } from 'vitest';

import type { ReportActivityClient } from '../../providers/report-activity.client.js';
import { CredentialEncryption } from '../../shared/security/credential-encryption.js';
import type {
  AuthorizedConnectionInput,
  ConnectionRepository,
  SyncConnection,
} from '../connections/connection.repository.js';
import type { ConnectionSummary } from '../connections/connection.types.js';
import type {
  EnabledRepository,
  RepositoryRepository,
} from '../repositories/repository.repository.js';
import type { RepositoryPage } from '../repositories/repository.types.js';

import { calculateReportDateRange } from './report-date.js';
import { InMemoryReportGenerationLock, type ReportGenerationLock } from './report-lock.js';
import { deduplicateActivities, groupActivities } from './report-mapper.js';
import type { ReportRepository, SaveReportInput } from './report.repository.js';
import { ReportService } from './report.service.js';
import type { GeneratedReport, NormalizedActivity, ReportHistoryPage } from './report.types.js';

const activity: NormalizedActivity = {
  provider: 'github',
  repositoryId: 'repository-1',
  repositoryName: 'owner/api',
  category: 'commit',
  externalId: 'sha-1',
  title: 'fix(api): correct report filtering',
  occurredAt: new Date('2026-08-17T02:00:00.000Z'),
  url: 'https://github.com/owner/api/commit/sha-1',
};

class ConnectionFixture implements ConnectionRepository {
  public connections: SyncConnection[] = [];
  public findAllOwnedByUser(): Promise<ConnectionSummary[]> {
    return Promise.resolve([]);
  }
  public deleteOwnedByUser(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public upsertAuthorized(_input: AuthorizedConnectionInput): Promise<ConnectionSummary> {
    throw new Error('Not used by report tests.');
  }
  public findOwnedForRepositorySync(): Promise<SyncConnection[]> {
    return Promise.resolve(this.connections);
  }
}

class RepositoryFixture implements RepositoryRepository {
  public enabled: EnabledRepository[] = [];
  public replaceAuthorized(): Promise<void> {
    return Promise.resolve();
  }
  public listOwned(_userId: string, page: number, limit: number): Promise<RepositoryPage> {
    return Promise.resolve({ items: [], total: 0, page, limit });
  }
  public setEnabledOwned(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public findEnabledOwned(): Promise<EnabledRepository[]> {
    return Promise.resolve(this.enabled);
  }
}

class ActivityFixture implements ReportActivityClient {
  public activities: NormalizedActivity[] = [activity, activity];
  public collect(): Promise<NormalizedActivity[]> {
    return Promise.resolve(this.activities);
  }
}

class ReportFixture implements ReportRepository {
  public timezone: string | null = 'Asia/Jakarta';
  public lastSave: SaveReportInput | null = null;
  public storedReport: GeneratedReport | null = null;
  public listOwned(_userId: string, page: number, limit: number): Promise<ReportHistoryPage> {
    return Promise.resolve({ items: [], total: 0, page, limit });
  }
  public findOwnedByDate(): Promise<GeneratedReport | null> {
    return Promise.resolve(this.storedReport);
  }
  public getUserTimezone(): Promise<string | null> {
    return Promise.resolve(this.timezone);
  }
  public replace(input: SaveReportInput): Promise<GeneratedReport> {
    this.lastSave = input;
    return Promise.resolve({
      id: '7d7df347-e8d9-46d2-b92c-cfb4a028eb30',
      reportDate: input.reportDate,
      summary: input.summary,
      totalCommits: input.totalCommits,
      totalMergeRequests: input.totalMergeRequests,
      totalReviews: input.totalReviews,
      generatedAt: new Date('2026-08-17T12:00:00.000Z'),
      items: input.items,
    });
  }
}

const connection: SyncConnection = {
  id: 'connection-1',
  provider: 'github',
  baseUrl: 'https://api.github.com',
  accessTokenEncrypted: null,
  installationId: '123',
  providerUserId: '42',
  providerUsername: 'developer',
};
const encryption = new CredentialEncryption(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
);

function createService(lock: ReportGenerationLock = new InMemoryReportGenerationLock()): {
  service: ReportService;
  reports: ReportFixture;
  connections: ConnectionFixture;
  repositories: RepositoryFixture;
} {
  const reports = new ReportFixture();
  const connections = new ConnectionFixture();
  const repositories = new RepositoryFixture();
  const service = new ReportService(
    reports,
    connections,
    repositories,
    new ActivityFixture(),
    encryption,
    lock,
  );
  return { service, reports, connections, repositories };
}

describe('report date ranges', () => {
  it('converts an Asia/Jakarta day to UTC boundaries', () => {
    const range = calculateReportDateRange('2026-08-17', 'Asia/Jakarta');
    expect(range.from.toISOString()).toBe('2026-08-16T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-17T17:00:00.000Z');
  });

  it('handles daylight-saving transitions without assuming a 24-hour day', () => {
    const range = calculateReportDateRange('2026-03-08', 'America/New_York');
    expect(range.from.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});

describe('report activity mapping', () => {
  it('deduplicates stable provider activity identifiers', () => {
    expect(deduplicateActivities([activity, activity])).toEqual([activity]);
  });

  it('groups related conventional commit messages and keeps source references', () => {
    const related = { ...activity, externalId: 'sha-2', title: 'fix(api): correct report totals' };
    const items = groupActivities([activity, related]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ activityCount: 2, category: 'commit' });
    expect(items[0]?.sourceData).toHaveLength(2);
  });
});

describe('ReportService', () => {
  it('returns not found when the requested report date is not owned by the user', async () => {
    const { service } = createService();

    await expect(service.getByDate('user-1', '2026-08-17')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('passes pagination through the ownership-scoped history repository', async () => {
    const { service } = createService();

    const history = await service.list('user-1', 2, 10);

    expect(history).toMatchObject({ page: 2, limit: 10, total: 0 });
  });

  it('blocks a second generation when the user lock is held', async () => {
    const lock: ReportGenerationLock = {
      acquire: () => Promise.resolve(false),
      release: () => Promise.resolve(),
    };
    const { service } = createService(lock);
    await expect(
      service.generate({
        userId: 'user-1',
        reportDate: '2026-08-17',
        connectionIds: ['connection-1'],
      }),
    ).rejects.toMatchObject({ code: 'REPORT_GENERATION_IN_PROGRESS', statusCode: 409 });
  });

  it('rejects connections that are not owned by the user', async () => {
    const { service } = createService();
    await expect(
      service.generate({
        userId: 'user-1',
        reportDate: '2026-08-17',
        connectionIds: ['connection-1'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('deduplicates activity, calculates totals, and persists one replacement', async () => {
    const { service, reports, connections, repositories } = createService();
    connections.connections = [connection];
    repositories.enabled = [
      {
        connectionId: 'connection-1',
        externalId: 'repository-1',
        fullName: 'owner/api',
      },
    ];

    const result = await service.generate({
      userId: 'user-1',
      reportDate: '2026-08-17',
      connectionIds: ['connection-1'],
    });

    expect(result.totalCommits).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(reports.lastSave).toMatchObject({ userId: 'user-1', reportDate: '2026-08-17' });
  });

  it('releases the lock when generation fails', async () => {
    const lock = new InMemoryReportGenerationLock();
    const { service } = createService(lock);
    await expect(
      service.generate({ userId: 'user-1', reportDate: '2026-08-17', connectionIds: ['missing'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await lock.acquire('user-1')).toBe(true);
  });
});
