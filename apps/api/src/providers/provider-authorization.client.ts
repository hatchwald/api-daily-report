import { createHash, randomBytes, sign } from 'node:crypto';

import { z } from 'zod';

import { ApplicationError } from '../shared/errors/application-error.js';

import type { ProviderHttpClient } from './provider-http-client.js';

const githubInstallationSchema = z.object({
  account: z.object({ id: z.number(), login: z.string() }),
});
const gitlabTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
});
const gitlabUserSchema = z.object({ id: z.number(), username: z.string() });

function parseProviderResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    throw new ApplicationError(
      'GIT_PROVIDER_UNAVAILABLE',
      'The Git provider returned an invalid response.',
      502,
    );
  }
  return result.data;
}

export interface ProviderIdentity {
  externalId: string;
  username: string;
}

export interface GitLabAuthorizationResult extends ProviderIdentity {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface ProviderAuthorizationClient {
  verifyGitHubInstallation(installationId: string): Promise<ProviderIdentity>;
  exchangeGitLabCode(input: {
    baseUrl: string;
    code: string;
    codeVerifier: string;
  }): Promise<GitLabAuthorizationResult>;
}

interface ProviderAuthorizationConfig {
  githubAppId: string;
  githubPrivateKey: string;
  gitlabClientId: string;
  gitlabClientSecret: string;
  gitlabRedirectUri: string;
}

export class DefaultProviderAuthorizationClient implements ProviderAuthorizationClient {
  public constructor(
    private readonly http: ProviderHttpClient,
    private readonly config: ProviderAuthorizationConfig,
  ) {}

  public async verifyGitHubInstallation(installationId: string): Promise<ProviderIdentity> {
    const response = await this.http.requestJson(
      `https://api.github.com/app/installations/${encodeURIComponent(installationId)}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${this.createGitHubAppJwt()}`,
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    const installation = parseProviderResponse(githubInstallationSchema, response);
    return {
      externalId: String(installation.account.id),
      username: installation.account.login,
    };
  }

  public async exchangeGitLabCode(input: {
    baseUrl: string;
    code: string;
    codeVerifier: string;
  }): Promise<GitLabAuthorizationResult> {
    const tokenResponse = await this.http.requestJson(`${input.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.gitlabClientId,
        client_secret: this.config.gitlabClientSecret,
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.config.gitlabRedirectUri,
      }),
    });
    const token = parseProviderResponse(gitlabTokenSchema, tokenResponse);
    const userResponse = await this.http.requestJson(`${input.baseUrl}/api/v4/user`, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const user = parseProviderResponse(gitlabUserSchema, userResponse);
    return {
      externalId: String(user.id),
      username: user.username,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null,
    };
  }

  private createGitHubAppJwt(): string {
    const now = Math.floor(Date.now() / 1_000);
    const encode = (value: object): string =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsignedToken = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: this.config.githubAppId,
    })}`;
    const privateKey = this.config.githubPrivateKey.replaceAll('\\n', '\n');
    const signature = sign('RSA-SHA256', Buffer.from(unsignedToken), privateKey).toString(
      'base64url',
    );
    return `${unsignedToken}.${signature}`;
  }
}

export function createOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function validateAllowedBaseUrl(baseUrl: string, allowedOrigins: readonly string[]): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.pathname !== '/' || !allowedOrigins.includes(url.origin)) {
    throw new ApplicationError(
      'GIT_PROVIDER_UNAVAILABLE',
      'This GitLab instance is not configured for OAuth.',
      422,
    );
  }
  return url.origin;
}
