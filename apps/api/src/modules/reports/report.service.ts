import type { ReportActivityClient } from '../../providers/report-activity.client.js';
import { ApplicationError } from '../../shared/errors/application-error.js';
import type { CredentialEncryption } from '../../shared/security/credential-encryption.js';
import type { ConnectionRepository } from '../connections/connection.repository.js';
import type { RepositoryRepository } from '../repositories/repository.repository.js';

import { calculateReportDateRange } from './report-date.js';
import type { ReportGenerationLock } from './report-lock.js';
import { deduplicateActivities, groupActivities } from './report-mapper.js';
import type { ReportRepository } from './report.repository.js';
import type { GeneratedReport, ReportHistoryPage } from './report.types.js';

export class ReportService {
  public constructor(
    private readonly reports: ReportRepository,
    private readonly connections: ConnectionRepository,
    private readonly repositories: RepositoryRepository,
    private readonly activityClient: ReportActivityClient,
    private readonly encryption: CredentialEncryption,
    private readonly lock: ReportGenerationLock,
  ) {}

  public list(userId: string, page: number, limit: number): Promise<ReportHistoryPage> {
    return this.reports.listOwned(userId, page, limit);
  }

  public async getByDate(userId: string, reportDate: string): Promise<GeneratedReport> {
    const report = await this.reports.findOwnedByDate(userId, reportDate);
    if (!report) throw new ApplicationError('NOT_FOUND', 'Report was not found.', 404);
    return report;
  }

  public async generate(input: {
    userId: string;
    reportDate: string;
    connectionIds: string[];
  }): Promise<GeneratedReport> {
    const acquired = await this.lock.acquire(input.userId);
    if (!acquired) {
      throw new ApplicationError(
        'REPORT_GENERATION_IN_PROGRESS',
        'A report is already being generated for this account.',
        409,
      );
    }

    try {
      return await this.generateWhileLocked(input);
    } finally {
      await this.lock.release(input.userId);
    }
  }

  private async generateWhileLocked(input: {
    userId: string;
    reportDate: string;
    connectionIds: string[];
  }): Promise<GeneratedReport> {
    const timezone = await this.reports.getUserTimezone(input.userId);
    if (!timezone)
      throw new ApplicationError('UNAUTHORIZED', 'Authenticated user was not found.', 401);
    const connectionIds = [...new Set(input.connectionIds)];
    const connections = await this.connections.findOwnedForRepositorySync(
      connectionIds,
      input.userId,
    );
    if (connections.length !== connectionIds.length) {
      throw new ApplicationError('FORBIDDEN', 'One or more Git connections are unavailable.', 403);
    }
    const repositories = await this.repositories.findEnabledOwned(connectionIds, input.userId);
    const range = calculateReportDateRange(input.reportDate, timezone);
    const activityBatches = await Promise.all(
      connections.map(async (connection) => {
        const connectionRepositories = repositories.filter(
          (repository) => repository.connectionId === connection.id,
        );
        const accessToken = connection.accessTokenEncrypted
          ? this.encryption.decrypt(connection.accessTokenEncrypted)
          : null;
        return this.activityClient.collect(connection, connectionRepositories, range, accessToken);
      }),
    );
    const activities = deduplicateActivities(activityBatches.flat());
    const items = groupActivities(activities);
    const totalCommits = activities.filter((activity) => activity.category === 'commit').length;
    const totalMergeRequests = activities.filter(
      (activity) => activity.category === 'merge_request',
    ).length;
    const totalReviews = activities.filter((activity) => activity.category === 'review').length;
    const repositoryCount = new Set(activities.map((activity) => activity.repositoryId)).size;
    const summary = `${String(totalCommits)} commits, ${String(totalMergeRequests)} merge requests, and ${String(totalReviews)} reviews across ${String(repositoryCount)} repositories.`;

    return this.reports.replace({
      userId: input.userId,
      reportDate: input.reportDate,
      summary,
      totalCommits,
      totalMergeRequests,
      totalReviews,
      items,
    });
  }
}
