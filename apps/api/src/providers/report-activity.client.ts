import { z } from 'zod';

import type { SyncConnection } from '../modules/connections/connection.repository.js';
import type { ReportDateRange } from '../modules/reports/report-date.js';
import type { NormalizedActivity } from '../modules/reports/report.types.js';
import type { EnabledRepository } from '../modules/repositories/repository.repository.js';
import { ApplicationError } from '../shared/errors/application-error.js';

import type { GitHubJwtProvider, RepositoryJsonHttpClient } from './repository-provider.client.js';

const githubTokenSchema = z.object({ token: z.string() });
const githubCommitsSchema = z.array(
  z.object({
    sha: z.string(),
    html_url: z.url().nullable(),
    commit: z.object({
      message: z.string(),
      author: z.object({ date: z.iso.datetime() }).nullable(),
    }),
  }),
);
const githubPullsSchema = z.array(
  z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    html_url: z.url().nullable(),
    updated_at: z.iso.datetime(),
    merged_at: z.iso.datetime().nullable(),
    user: z.object({ login: z.string() }).nullable(),
  }),
);
const githubReviewsSchema = z.array(
  z.object({
    id: z.number(),
    html_url: z.url().nullable(),
    submitted_at: z.iso.datetime().nullable(),
    state: z.string(),
    user: z.object({ login: z.string() }).nullable(),
  }),
);
const gitlabCommitsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    committed_date: z.iso.datetime(),
    web_url: z.url().nullable(),
  }),
);
const gitlabMergeRequestsSchema = z.array(
  z.object({
    id: z.number(),
    title: z.string(),
    updated_at: z.iso.datetime(),
    web_url: z.url().nullable(),
  }),
);
const gitlabEventsSchema = z.array(
  z.object({
    id: z.number(),
    project_id: z.number(),
    target_id: z.number().nullable(),
    target_title: z.string().nullable(),
    created_at: z.iso.datetime(),
  }),
);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApplicationError(
      'GIT_PROVIDER_UNAVAILABLE',
      'Git provider activity response was invalid.',
      502,
    );
  }
  return result.data;
}

export interface ReportActivityClient {
  collect(
    connection: SyncConnection,
    repositories: EnabledRepository[],
    range: ReportDateRange,
    accessToken: string | null,
  ): Promise<NormalizedActivity[]>;
}

export class DefaultReportActivityClient implements ReportActivityClient {
  public constructor(
    private readonly http: RepositoryJsonHttpClient,
    private readonly githubJwt: GitHubJwtProvider,
  ) {}

  public async collect(
    connection: SyncConnection,
    repositories: EnabledRepository[],
    range: ReportDateRange,
    accessToken: string | null,
  ): Promise<NormalizedActivity[]> {
    if (connection.provider === 'github') {
      if (!connection.installationId)
        throw new ApplicationError('GIT_AUTH_EXPIRED', 'GitHub installation is unavailable.', 401);
      const token = await this.createGitHubInstallationToken(connection.installationId);
      const batches = await Promise.all(
        repositories.map(async (repository) =>
          this.collectGitHubRepository(repository, connection.providerUsername, range, token),
        ),
      );
      return batches.flat();
    }
    if (!accessToken)
      throw new ApplicationError('GIT_AUTH_EXPIRED', 'GitLab authorization is unavailable.', 401);
    const batches = await Promise.all(
      repositories.map(async (repository) =>
        this.collectGitLabRepository(repository, connection, range, accessToken),
      ),
    );
    const reviews = await this.collectGitLabReviews(connection, repositories, range, accessToken);
    return [...batches.flat(), ...reviews];
  }

  private async createGitHubInstallationToken(installationId: string): Promise<string> {
    const response = await this.http.requestJson(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      { method: 'POST', headers: { authorization: `Bearer ${this.githubJwt.create()}` } },
    );
    return parse(githubTokenSchema, response).token;
  }

  private async collectGitHubRepository(
    repository: EnabledRepository,
    username: string,
    range: ReportDateRange,
    token: string,
  ): Promise<NormalizedActivity[]> {
    const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' };
    const repositoryPath = repository.fullName.split('/').map(encodeURIComponent).join('/');
    const githubCommits = await this.fetchPages(
      githubCommitsSchema,
      (page) =>
        `https://api.github.com/repos/${repositoryPath}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(range.from.toISOString())}&until=${encodeURIComponent(range.to.toISOString())}&per_page=100&page=${String(page)}`,
      { headers },
    );
    const githubPulls = await this.fetchPages(
      githubPullsSchema,
      (page) =>
        `https://api.github.com/repos/${repositoryPath}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${String(page)}`,
      { headers },
    );
    const commits: NormalizedActivity[] = githubCommits.map((commit) => ({
      provider: 'github',
      repositoryId: repository.externalId,
      repositoryName: repository.fullName,
      category: 'commit',
      externalId: commit.sha,
      title: commit.commit.message.split('\n')[0] ?? commit.sha,
      occurredAt: new Date(commit.commit.author?.date ?? range.from),
      url: commit.html_url,
    }));
    const relevantPulls = githubPulls.filter((pull) => {
      const occurredAt = new Date(pull.merged_at ?? pull.updated_at);
      return occurredAt >= range.from && occurredAt < range.to;
    });
    const mergeRequests: NormalizedActivity[] = relevantPulls
      .filter((pull) => pull.user?.login === username)
      .map((pull) => ({
        provider: 'github',
        repositoryId: repository.externalId,
        repositoryName: repository.fullName,
        category: 'merge_request',
        externalId: String(pull.id),
        title: pull.title,
        occurredAt: new Date(pull.merged_at ?? pull.updated_at),
        url: pull.html_url,
      }));
    const reviewBatches = await Promise.all(
      relevantPulls.map(async (pull) => {
        const reviews = await this.fetchPages(
          githubReviewsSchema,
          (page) =>
            `https://api.github.com/repos/${repositoryPath}/pulls/${String(pull.number)}/reviews?per_page=100&page=${String(page)}`,
          { headers },
        );
        return reviews
          .filter((review) => {
            if (review.user?.login !== username || !review.submitted_at) return false;
            const submittedAt = new Date(review.submitted_at);
            return submittedAt >= range.from && submittedAt < range.to;
          })
          .flatMap<NormalizedActivity>((review) => {
            if (!review.submitted_at) return [];
            return [
              {
                provider: 'github',
                repositoryId: repository.externalId,
                repositoryName: repository.fullName,
                category: 'review',
                externalId: String(review.id),
                title: `Reviewed: ${pull.title}`,
                occurredAt: new Date(review.submitted_at),
                url: review.html_url,
              },
            ];
          });
      }),
    );
    return [...commits, ...mergeRequests, ...reviewBatches.flat()];
  }

  private async collectGitLabRepository(
    repository: EnabledRepository,
    connection: SyncConnection,
    range: ReportDateRange,
    token: string,
  ): Promise<NormalizedActivity[]> {
    const headers = { authorization: `Bearer ${token}` };
    const project = encodeURIComponent(repository.externalId);
    const gitlabCommits = await this.fetchPages(
      gitlabCommitsSchema,
      (page) =>
        `${connection.baseUrl}/api/v4/projects/${project}/repository/commits?author=${encodeURIComponent(connection.providerUsername)}&since=${encodeURIComponent(range.from.toISOString())}&until=${encodeURIComponent(range.to.toISOString())}&per_page=100&page=${String(page)}`,
      { headers },
    );
    const gitlabMergeRequests = await this.fetchPages(
      gitlabMergeRequestsSchema,
      (page) =>
        `${connection.baseUrl}/api/v4/projects/${project}/merge_requests?scope=all&author_username=${encodeURIComponent(connection.providerUsername)}&updated_after=${encodeURIComponent(range.from.toISOString())}&updated_before=${encodeURIComponent(range.to.toISOString())}&per_page=100&page=${String(page)}`,
      { headers },
    );
    return [
      ...gitlabCommits.map<NormalizedActivity>((commit) => ({
        provider: 'gitlab',
        repositoryId: repository.externalId,
        repositoryName: repository.fullName,
        category: 'commit',
        externalId: commit.id,
        title: commit.title,
        occurredAt: new Date(commit.committed_date),
        url: commit.web_url,
      })),
      ...gitlabMergeRequests.map<NormalizedActivity>((mergeRequest) => ({
        provider: 'gitlab',
        repositoryId: repository.externalId,
        repositoryName: repository.fullName,
        category: 'merge_request',
        externalId: String(mergeRequest.id),
        title: mergeRequest.title,
        occurredAt: new Date(mergeRequest.updated_at),
        url: mergeRequest.web_url,
      })),
    ];
  }

  private async collectGitLabReviews(
    connection: SyncConnection,
    repositories: EnabledRepository[],
    range: ReportDateRange,
    token: string,
  ): Promise<NormalizedActivity[]> {
    const events = await this.fetchPages(
      gitlabEventsSchema,
      (page) =>
        `${connection.baseUrl}/api/v4/users/${encodeURIComponent(connection.providerUserId)}/events?action=approved&target_type=merge_request&after=${range.from.toISOString().slice(0, 10)}&before=${range.to.toISOString().slice(0, 10)}&per_page=100&page=${String(page)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const byExternalId = new Map(
      repositories.map((repository) => [repository.externalId, repository]),
    );
    return events.flatMap((event) => {
      const repository = byExternalId.get(String(event.project_id));
      const occurredAt = new Date(event.created_at);
      if (!repository || !event.target_id || occurredAt < range.from || occurredAt >= range.to) {
        return [];
      }
      return [
        {
          provider: 'gitlab' as const,
          repositoryId: repository.externalId,
          repositoryName: repository.fullName,
          category: 'review' as const,
          externalId: String(event.id),
          title: `Reviewed: ${event.target_title ?? `merge request ${String(event.target_id)}`}`,
          occurredAt,
          url: null,
        },
      ];
    });
  }

  private async fetchPages<T>(
    schema: z.ZodType<T[]>,
    createUrl: (page: number) => string,
    init: RequestInit,
  ): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page += 1) {
      const response = await this.http.requestJson(createUrl(page), init);
      const pageItems = parse(schema, response);
      items.push(...pageItems);
      if (pageItems.length < 100) return items;
    }
  }
}
