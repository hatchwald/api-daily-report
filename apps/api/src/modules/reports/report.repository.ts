import type { PrismaClient } from '../../generated/prisma/client.js';

import type { GeneratedReport, GeneratedReportItem } from './report.types.js';

export interface SaveReportInput {
  userId: string;
  reportDate: string;
  summary: string;
  totalCommits: number;
  totalMergeRequests: number;
  totalReviews: number;
  items: GeneratedReportItem[];
}

export interface ReportRepository {
  getUserTimezone(userId: string): Promise<string | null>;
  replace(input: SaveReportInput): Promise<GeneratedReport>;
}

export class PrismaReportRepository implements ReportRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getUserTimezone(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? null;
  }

  public async replace(input: SaveReportInput): Promise<GeneratedReport> {
    const generatedAt = new Date();
    const reportDate = new Date(`${input.reportDate}T00:00:00.000Z`);
    const report = await this.prisma.$transaction(async (transaction) => {
      const savedReport = await transaction.report.upsert({
        where: { userId_reportDate: { userId: input.userId, reportDate } },
        create: {
          userId: input.userId,
          reportDate,
          summary: input.summary,
          totalCommits: input.totalCommits,
          totalMergeRequests: input.totalMergeRequests,
          totalReviews: input.totalReviews,
          generatedAt,
        },
        update: {
          summary: input.summary,
          totalCommits: input.totalCommits,
          totalMergeRequests: input.totalMergeRequests,
          totalReviews: input.totalReviews,
          generatedAt,
        },
      });
      await transaction.reportItem.deleteMany({ where: { reportId: savedReport.id } });
      if (input.items.length > 0) {
        await transaction.reportItem.createMany({
          data: input.items.map((item) => ({
            reportId: savedReport.id,
            provider: item.provider,
            repositoryName: item.repositoryName,
            category: item.category,
            title: item.title,
            description: item.description,
            activityCount: item.activityCount,
            sourceData: item.sourceData.map((source) => ({
              category: source.category,
              externalId: source.externalId,
              title: source.title,
              url: source.url,
            })),
          })),
        });
      }
      return savedReport;
    });

    return {
      id: report.id,
      reportDate: input.reportDate,
      summary: input.summary,
      totalCommits: input.totalCommits,
      totalMergeRequests: input.totalMergeRequests,
      totalReviews: input.totalReviews,
      generatedAt,
      items: input.items,
    };
  }
}
