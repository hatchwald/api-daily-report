import { ApplicationError } from '../shared/errors/application-error.js';

export class ProviderHttpClient {
  public constructor(private readonly timeoutMs: number) {}

  public async requestJson(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      throw new ApplicationError(
        'GIT_PROVIDER_UNAVAILABLE',
        'The Git provider could not be reached.',
        503,
        { cause: error instanceof Error ? error.name : 'UnknownError' },
      );
    }

    const providerLimitReached =
      response.status === 429 ||
      (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
    if (providerLimitReached) {
      throw new ApplicationError(
        'GIT_PROVIDER_RATE_LIMITED',
        'The Git provider rate limit has been reached.',
        429,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApplicationError('GIT_AUTH_EXPIRED', 'Git provider authorization failed.', 401);
    }
    if (!response.ok) {
      const requestUrl = new URL(url);
      throw new ApplicationError(
        'GIT_PROVIDER_UNAVAILABLE',
        'The Git provider returned an unexpected response.',
        502,
        {
          providerStatus: response.status,
          method: init.method ?? 'GET',
          origin: requestUrl.origin,
          pathname: requestUrl.pathname,
          providerRequestId:
            response.headers.get('x-github-request-id') ??
            response.headers.get('x-request-id') ??
            undefined,
        },
      );
    }

    return response.json();
  }
}
