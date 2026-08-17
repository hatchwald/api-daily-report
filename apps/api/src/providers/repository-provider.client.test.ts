import { describe, expect, it } from 'vitest';

import {
  DefaultRepositoryProviderClient,
  type GitHubJwtProvider,
  type RepositoryJsonHttpClient,
} from './repository-provider.client.js';

class QueuedHttpClient implements RepositoryJsonHttpClient {
  public readonly urls: string[] = [];

  public constructor(private readonly responses: unknown[]) {}

  public requestJson(url: string): Promise<unknown> {
    this.urls.push(url);
    const response = this.responses.shift();
    if (response === undefined) throw new Error('No queued provider response.');
    return Promise.resolve(response);
  }
}

const jwtIssuer: GitHubJwtProvider = { create: () => 'signed-jwt' };

describe('DefaultRepositoryProviderClient', () => {
  it('loads every GitHub repository page and normalizes responses', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `repository-${String(index + 1)}`,
      full_name: `owner/repository-${String(index + 1)}`,
      html_url: `https://github.com/owner/repository-${String(index + 1)}`,
    }));
    const http = new QueuedHttpClient([
      { token: 'installation-token' },
      { repositories: firstPage },
      {
        repositories: [
          {
            id: 101,
            name: 'repository-101',
            full_name: 'owner/repository-101',
            html_url: 'https://github.com/owner/repository-101',
          },
        ],
      },
    ]);
    const client = new DefaultRepositoryProviderClient(http, jwtIssuer);

    const repositories = await client.getGitHubRepositories('123');

    expect(repositories).toHaveLength(101);
    expect(repositories[100]).toMatchObject({
      provider: 'github',
      externalId: '101',
      fullName: 'owner/repository-101',
    });
    expect(http.urls.at(-1)).toContain('page=2');
  });

  it('loads every GitLab repository page and normalizes responses', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `repository-${String(index + 1)}`,
      path_with_namespace: `group/repository-${String(index + 1)}`,
      web_url: `https://gitlab.example.com/group/repository-${String(index + 1)}`,
    }));
    const http = new QueuedHttpClient([
      firstPage,
      [
        {
          id: 101,
          name: 'repository-101',
          path_with_namespace: 'group/repository-101',
          web_url: 'https://gitlab.example.com/group/repository-101',
        },
      ],
    ]);
    const client = new DefaultRepositoryProviderClient(http, jwtIssuer);

    const repositories = await client.getGitLabRepositories(
      'https://gitlab.example.com',
      'access-token',
    );

    expect(repositories).toHaveLength(101);
    expect(repositories[100]).toMatchObject({ provider: 'gitlab', externalId: '101' });
    expect(http.urls.at(-1)).toContain('page=2');
  });
});
