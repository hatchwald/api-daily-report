import type { GitProviderName } from '../../providers/git-provider.interface.js';

export type ActivityCategory = 'commit' | 'merge_request' | 'review';

export interface NormalizedActivity {
  provider: GitProviderName;
  repositoryId: string;
  repositoryName: string;
  category: ActivityCategory;
  externalId: string;
  title: string;
  occurredAt: Date;
  url: string | null;
}

export interface ReportSourceReference {
  category: ActivityCategory;
  externalId: string;
  title: string;
  url: string | null;
}

export interface GeneratedReportItem {
  provider: GitProviderName;
  repositoryName: string;
  category: ActivityCategory;
  title: string;
  description: string;
  activityCount: number;
  sourceData: ReportSourceReference[];
}

export interface GeneratedReport {
  id: string;
  reportDate: string;
  summary: string;
  totalCommits: number;
  totalMergeRequests: number;
  totalReviews: number;
  generatedAt: Date;
  items: GeneratedReportItem[];
}

export interface ReportHistoryEntry {
  id: string;
  reportDate: string;
  summary: string;
  totalCommits: number;
  totalMergeRequests: number;
  totalReviews: number;
  generatedAt: Date;
}

export interface ReportHistoryPage {
  items: ReportHistoryEntry[];
  total: number;
  page: number;
  limit: number;
}
