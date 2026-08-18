import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { ApplicationError } from '../../shared/errors/application-error.js';

import { sendConnectionPopupResult } from './connection-popup.js';

const openApps = new Set<FastifyInstance>();

afterEach(async () => {
  await Promise.all([...openApps].map((app) => app.close()));
  openApps.clear();
});

describe('connection popup response', () => {
  it('notifies the frontend and presents a closable success page', async () => {
    const app = Fastify({ logger: false });
    openApps.add(app);
    app.get('/callback', (request, reply) =>
      sendConnectionPopupResult(request, reply, {
        provider: 'github',
        frontendOrigin: 'http://localhost:5173',
        complete: () => Promise.resolve('connection-1'),
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/callback' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['content-security-policy']).toContain("script-src 'nonce-");
    expect(response.body).toContain('Connection successful');
    expect(response.body).toContain('git-provider-connection');
    expect(response.body).toContain('http://localhost:5173');
    expect(response.body).toContain('window.close()');
  });

  it('returns a safe popup page when provider authorization fails', async () => {
    const app = Fastify({ logger: false });
    openApps.add(app);
    app.get('/callback', (request, reply) =>
      sendConnectionPopupResult(request, reply, {
        provider: 'gitlab',
        frontendOrigin: 'http://localhost:5173',
        complete: () =>
          Promise.reject(
            new ApplicationError('OAUTH_STATE_INVALID', 'Sensitive internal detail.', 400),
          ),
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/callback' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Connection failed');
    expect(response.body).toContain('"status":"error"');
    expect(response.body).not.toContain('Sensitive internal detail.');
  });
});
