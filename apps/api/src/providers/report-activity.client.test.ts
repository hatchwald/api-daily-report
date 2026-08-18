import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../shared/errors/application-error.js';

import { DefaultReportActivityClient } from './report-activity.client.js';
import type { RepositoryJsonHttpClient } from './repository-provider.client.js';

const connection = {
  id: 'connection-1',
  provider: 'gitlab' as const,
  baseUrl: 'https://gitlab.com',
  accessTokenEncrypted: 'encrypted-token',
  installationId: null,
  providerUserId: '42',
  providerUsername: 'developer',
};
const repositories = [
  { connectionId: 'connection-1', externalId: '83044903', fullName: 'group/project' },
];
const range = {
  from: new Date('2026-08-18T17:00:00.000Z'),
  to: new Date('2026-08-19T17:00:00.000Z'),
};
const githubJwt = { create: () => 'unused' };

describe('DefaultReportActivityClient', () => {
  it('skips a GitLab repository when GitLab reports that it is not found', async () => {
    const http: RepositoryJsonHttpClient = {
      requestJson: (url) => {
        if (url.includes('/repository/commits')) {
          throw new ApplicationError(
            'GIT_PROVIDER_UNAVAILABLE',
            'The Git provider returned an unexpected response.',
            502,
            { providerStatus: 404 },
          );
        }
        return Promise.resolve([]);
      },
    };
    const client = new DefaultReportActivityClient(http, githubJwt);

    const activities = await client.collect(connection, repositories, range, 'access-token');

    expect(activities).toEqual([]);
  });

  it('does not hide non-404 GitLab failures', async () => {
    const providerError = new ApplicationError(
      'GIT_PROVIDER_UNAVAILABLE',
      'The Git provider returned an unexpected response.',
      502,
      { providerStatus: 500 },
    );
    const http: RepositoryJsonHttpClient = {
      requestJson: () => {
        throw providerError;
      },
    };
    const client = new DefaultReportActivityClient(http, githubJwt);

    await expect(client.collect(connection, repositories, range, 'access-token')).rejects.toBe(
      providerError,
    );
  });
});
