import { ApplicationError } from '../shared/errors/application-error.js';

import type { GitProvider, GitProviderName } from './git-provider.interface.js';

export interface ProviderConnection {
  provider: GitProviderName;
  baseUrl: string;
  accessToken: string | null;
  installationId: string | null;
}

export type GitProviderBuilder = (connection: ProviderConnection) => GitProvider;

export class GitProviderFactory {
  public constructor(private readonly builders: ReadonlyMap<GitProviderName, GitProviderBuilder>) {}

  public create(connection: ProviderConnection): GitProvider {
    const builder = this.builders.get(connection.provider);
    if (!builder) {
      throw new ApplicationError(
        'GIT_PROVIDER_UNAVAILABLE',
        `The ${connection.provider} provider is not configured.`,
        503,
      );
    }

    return builder(connection);
  }
}
