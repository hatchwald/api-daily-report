import { z } from 'zod';

import { ApplicationError } from '../shared/errors/application-error.js';

import type { GitRepository } from './git-provider.interface.js';

const githubTokenSchema = z.object({ token: z.string() });
const githubRepositoriesSchema = z.object({
  repositories: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      full_name: z.string(),
      html_url: z.url().nullable(),
    }),
  ),
});
const gitlabRepositoriesSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    path_with_namespace: z.string(),
    web_url: z.url().nullable(),
  }),
);

function parseProviderResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    throw new ApplicationError(
      'GIT_PROVIDER_UNAVAILABLE',
      'The Git provider returned an invalid repository response.',
      502,
    );
  }
  return result.data;
}

export interface RepositoryProviderClient {
  getGitHubRepositories(installationId: string): Promise<GitRepository[]>;
  getGitLabRepositories(baseUrl: string, accessToken: string): Promise<GitRepository[]>;
}

export interface RepositoryJsonHttpClient {
  requestJson(url: string, init: RequestInit): Promise<unknown>;
}

export interface GitHubJwtProvider {
  create(): string;
}

export class DefaultRepositoryProviderClient implements RepositoryProviderClient {
  public constructor(
    private readonly http: RepositoryJsonHttpClient,
    private readonly githubJwt: GitHubJwtProvider,
  ) {}

  public async getGitHubRepositories(installationId: string): Promise<GitRepository[]> {
    const tokenResponse = await this.http.requestJson(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${this.githubJwt.create()}`,
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    const { token } = parseProviderResponse(githubTokenSchema, tokenResponse);
    const repositories: GitRepository[] = [];
    for (let page = 1; ; page += 1) {
      const response = await this.http.requestJson(
        `https://api.github.com/installation/repositories?per_page=100&page=${String(page)}`,
        {
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'x-github-api-version': '2022-11-28',
          },
        },
      );
      const result = parseProviderResponse(githubRepositoriesSchema, response);
      repositories.push(
        ...result.repositories.map((repository) => ({
          provider: 'github' as const,
          externalId: String(repository.id),
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
        })),
      );
      if (result.repositories.length < 100) break;
    }
    return repositories;
  }

  public async getGitLabRepositories(
    baseUrl: string,
    accessToken: string,
  ): Promise<GitRepository[]> {
    const repositories: GitRepository[] = [];
    for (let page = 1; ; page += 1) {
      const response = await this.http.requestJson(
        `${baseUrl}/api/v4/projects?membership=true&simple=true&per_page=100&page=${String(page)}`,
        { headers: { authorization: `Bearer ${accessToken}` } },
      );
      const result = parseProviderResponse(gitlabRepositoriesSchema, response);
      repositories.push(
        ...result.map((repository) => ({
          provider: 'gitlab' as const,
          externalId: String(repository.id),
          name: repository.name,
          fullName: repository.path_with_namespace,
          url: repository.web_url,
        })),
      );
      if (result.length < 100) break;
    }
    return repositories;
  }
}
