import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import { ApplicationError } from '../../shared/errors/application-error.js';

import type {
  GeneratedReport,
  GeneratedReportItem,
  ReportHistoryPage,
  ReportSourceReference,
} from './report.types.js';

const sourceDataSchema = z.array(
  z.object({
    category: z.enum(['commit', 'merge_request', 'review']),
    externalId: z.string(),
    title: z.string(),
    url: z.url().nullable(),
  }),
);

function formatReportDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseSourceData(input: unknown): ReportSourceReference[] {
  const result = sourceDataSchema.safeParse(input);
  if (!result.success) {
    throw new ApplicationError('REPORT_DATA_INVALID', 'Stored report data is invalid.', 500);
  }
  return result.data;
}

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
  listOwned(userId: string, page: number, limit: number): Promise<ReportHistoryPage>;
  findOwnedByDate(userId: string, reportDate: string): Promise<GeneratedReport | null>;
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

  public async listOwned(userId: string, page: number, limit: number): Promise<ReportHistoryPage> {
    const where = { userId };
    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          reportDate: true,
          summary: true,
          totalCommits: true,
          totalMergeRequests: true,
          totalReviews: true,
          generatedAt: true,
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return {
      items: reports.map((report) => ({
        ...report,
        reportDate: formatReportDate(report.reportDate),
      })),
      total,
      page,
      limit,
    };
  }

  public async findOwnedByDate(
    userId: string,
    reportDate: string,
  ): Promise<GeneratedReport | null> {
    const report = await this.prisma.report.findUnique({
      where: {
        userId_reportDate: { userId, reportDate: new Date(`${reportDate}T00:00:00.000Z`) },
      },
      include: { items: { orderBy: [{ repositoryName: 'asc' }, { title: 'asc' }] } },
    });
    if (!report) return null;
    return {
      id: report.id,
      reportDate: formatReportDate(report.reportDate),
      summary: report.summary,
      totalCommits: report.totalCommits,
      totalMergeRequests: report.totalMergeRequests,
      totalReviews: report.totalReviews,
      generatedAt: report.generatedAt,
      items: report.items.map((item) => ({
        provider: item.provider === 'github' ? 'github' : 'gitlab',
        repositoryName: item.repositoryName,
        category:
          item.category === 'commit'
            ? 'commit'
            : item.category === 'merge_request'
              ? 'merge_request'
              : 'review',
        title: item.title,
        description: item.description,
        activityCount: item.activityCount,
        sourceData: parseSourceData(item.sourceData),
      })),
    };
  }
}
