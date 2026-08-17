export type GitProviderName = 'github' | 'gitlab';

export interface GitUser {
  externalId: string;
  username: string;
  displayName: string | null;
  profileUrl: string | null;
}

export interface GitRepository {
  provider: GitProviderName;
  externalId: string;
  name: string;
  fullName: string;
  url: string | null;
}

export interface ActivityQuery {
  repositoryExternalId: string;
  from: Date;
  to: Date;
}

export interface GitCommit {
  provider: GitProviderName;
  repositoryId: string;
  repositoryName: string;
  externalId: string;
  sha: string;
  title: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: Date;
  url: string | null;
}

export interface GitMergeRequest {
  provider: GitProviderName;
  repositoryId: string;
  externalId: string;
  title: string;
  state: 'open' | 'closed' | 'merged';
  updatedAt: Date;
  url: string | null;
}

export interface GitReview {
  provider: GitProviderName;
  repositoryId: string;
  externalId: string;
  title: string;
  reviewedAt: Date;
  url: string | null;
}

export interface GitProvider {
  getCurrentUser(): Promise<GitUser>;
  getRepositories(): Promise<GitRepository[]>;
  getCommits(input: ActivityQuery): Promise<GitCommit[]>;
  getMergeRequests(input: ActivityQuery): Promise<GitMergeRequest[]>;
  getReviews(input: ActivityQuery): Promise<GitReview[]>;
}
