import {
  createOAuthState,
  createPkce,
  type GitLabAuthorizationResult,
  type ProviderAuthorizationClient,
  validateAllowedBaseUrl,
} from '../../providers/provider-authorization.client.js';
import { ApplicationError } from '../../shared/errors/application-error.js';
import type { CredentialEncryption } from '../../shared/security/credential-encryption.js';

import type { ConnectionRepository } from './connection.repository.js';
import type { ConnectionSummary } from './connection.types.js';

interface ConnectionAuthorizationConfig {
  githubAppSlug: string;
  gitlabClientId: string;
  gitlabRedirectUri: string;
  gitlabAllowedBaseUrls: readonly string[];
}

export interface GitLabAuthorizationRequest {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  baseUrl: string;
}

export class ConnectionAuthorizationService {
  public constructor(
    private readonly connections: ConnectionRepository,
    private readonly authorizationClient: ProviderAuthorizationClient,
    private readonly encryption: CredentialEncryption,
    private readonly config: ConnectionAuthorizationConfig,
  ) {}

  public beginGitHubInstallation(): { authorizationUrl: string; state: string } {
    const state = createOAuthState();
    const url = new URL(`https://github.com/apps/${this.config.githubAppSlug}/installations/new`);
    url.searchParams.set('state', state);
    return { authorizationUrl: url.toString(), state };
  }

  public async completeGitHubInstallation(input: {
    userId: string;
    installationId: string;
    state: string;
    expectedState: string | undefined;
  }): Promise<ConnectionSummary> {
    this.assertState(input.state, input.expectedState);
    const identity = await this.authorizationClient.verifyGitHubInstallation(input.installationId);
    return this.connections.upsertAuthorized({
      userId: input.userId,
      provider: 'github',
      baseUrl: 'https://api.github.com',
      providerUserId: identity.externalId,
      providerUsername: identity.username,
      authType: 'github_app',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      installationId: input.installationId,
    });
  }

  public beginGitLabAuthorization(baseUrl: string): GitLabAuthorizationRequest {
    const allowedBaseUrl = validateAllowedBaseUrl(baseUrl, this.config.gitlabAllowedBaseUrls);
    const state = createOAuthState();
    const pkce = createPkce();
    const url = new URL('/oauth/authorize', allowedBaseUrl);
    url.searchParams.set('client_id', this.config.gitlabClientId);
    url.searchParams.set('redirect_uri', this.config.gitlabRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_api');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return {
      authorizationUrl: url.toString(),
      state,
      codeVerifier: pkce.verifier,
      baseUrl: allowedBaseUrl,
    };
  }

  public async completeGitLabAuthorization(input: {
    userId: string;
    code: string;
    state: string;
    pending: { state: string; codeVerifier: string; baseUrl: string } | undefined;
  }): Promise<ConnectionSummary> {
    this.assertState(input.state, input.pending?.state);
    if (!input.pending) {
      throw new ApplicationError(
        'OAUTH_STATE_INVALID',
        'OAuth session is invalid or expired.',
        400,
      );
    }
    const authorization = await this.authorizationClient.exchangeGitLabCode({
      baseUrl: input.pending.baseUrl,
      code: input.code,
      codeVerifier: input.pending.codeVerifier,
    });
    return this.persistGitLabConnection(input.userId, input.pending.baseUrl, authorization);
  }

  private persistGitLabConnection(
    userId: string,
    baseUrl: string,
    authorization: GitLabAuthorizationResult,
  ): Promise<ConnectionSummary> {
    return this.connections.upsertAuthorized({
      userId,
      provider: 'gitlab',
      baseUrl,
      providerUserId: authorization.externalId,
      providerUsername: authorization.username,
      authType: 'oauth2',
      accessTokenEncrypted: this.encryption.encrypt(authorization.accessToken),
      refreshTokenEncrypted: authorization.refreshToken
        ? this.encryption.encrypt(authorization.refreshToken)
        : null,
      tokenExpiresAt: authorization.expiresAt,
      installationId: null,
    });
  }

  private assertState(received: string, expected: string | undefined): void {
    if (!expected || received !== expected) {
      throw new ApplicationError(
        'OAUTH_STATE_INVALID',
        'OAuth session is invalid or expired.',
        400,
      );
    }
  }
}
