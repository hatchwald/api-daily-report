import { describe, expect, it, vi } from 'vitest';

import { GitProviderFactory } from './git-provider.factory.js';
import type { GitProvider } from './git-provider.interface.js';

const provider = {} as GitProvider;

describe('GitProviderFactory', () => {
  it('creates a provider using the registered builder', () => {
    const builder = vi.fn(() => provider);
    const factory = new GitProviderFactory(new Map([['github', builder]]));
    const connection = {
      provider: 'github' as const,
      baseUrl: 'https://api.github.com',
      accessToken: null,
      installationId: '123',
    };

    expect(factory.create(connection)).toBe(provider);
    expect(builder).toHaveBeenCalledWith(connection);
  });

  it('returns a domain error when a provider is not configured', () => {
    const factory = new GitProviderFactory(new Map());

    expect(() =>
      factory.create({
        provider: 'gitlab',
        baseUrl: 'https://gitlab.com',
        accessToken: null,
        installationId: null,
      }),
    ).toThrow(expect.objectContaining({ code: 'GIT_PROVIDER_UNAVAILABLE', statusCode: 503 }));
  });
});
