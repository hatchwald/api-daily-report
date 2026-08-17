import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUserId } from '../../plugins/auth.js';

import type { ConnectionAuthorizationService } from './connection-auth.service.js';
import {
  authorizationResponseSchema,
  connectionErrorResponseSchema,
  connectionIdParamsJsonSchema,
  connectionListResponseSchema,
  connectionParamsSchema,
  gitHubCallbackQuerySchema,
  gitLabCallbackQuerySchema,
  gitLabConnectBodySchema,
  oauthCallbackResponseSchema,
} from './connection.schema.js';
import type { ConnectionService } from './connection.service.js';

export interface ConnectionRoutesOptions {
  connectionService: ConnectionService;
  authorizationService: ConnectionAuthorizationService;
}

export function connectionRoutes(app: FastifyInstance, options: ConnectionRoutesOptions): void {
  app.post(
    '/github',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Start GitHub App installation',
        response: { 200: authorizationResponseSchema, 401: connectionErrorResponseSchema },
      },
    },
    (request) => {
      requireAuthenticatedUserId(request);
      const authorization = options.authorizationService.beginGitHubInstallation();
      request.session.githubInstallationState = authorization.state;
      return { success: true, data: { authorizationUrl: authorization.authorizationUrl } };
    },
  );

  app.get(
    '/github/callback',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Complete GitHub App installation',
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['installation_id', 'state'],
          properties: {
            installation_id: { type: 'string', pattern: '^\\d+$' },
            state: { type: 'string', minLength: 32 },
            setup_action: { type: 'string', enum: ['install', 'update'] },
          },
        },
        response: {
          201: oauthCallbackResponseSchema,
          400: connectionErrorResponseSchema,
          401: connectionErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuthenticatedUserId(request);
      const query = gitHubCallbackQuerySchema.parse(request.query);
      const expectedState = request.session.githubInstallationState;
      delete request.session.githubInstallationState;
      const connection = await options.authorizationService.completeGitHubInstallation({
        userId,
        installationId: query.installation_id,
        state: query.state,
        expectedState,
      });
      return reply.status(201).send({ success: true, data: { connectionId: connection.id } });
    },
  );

  app.post(
    '/gitlab',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Start GitLab OAuth authorization',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['baseUrl'],
          properties: { baseUrl: { type: 'string', format: 'uri' } },
        },
        response: {
          200: authorizationResponseSchema,
          401: connectionErrorResponseSchema,
          422: connectionErrorResponseSchema,
        },
      },
    },
    (request) => {
      requireAuthenticatedUserId(request);
      const { baseUrl } = gitLabConnectBodySchema.parse(request.body);
      const authorization = options.authorizationService.beginGitLabAuthorization(baseUrl);
      request.session.gitlabOAuth = {
        state: authorization.state,
        codeVerifier: authorization.codeVerifier,
        baseUrl: authorization.baseUrl,
      };
      return { success: true, data: { authorizationUrl: authorization.authorizationUrl } };
    },
  );

  app.get(
    '/gitlab/callback',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Complete GitLab OAuth authorization',
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'state'],
          properties: {
            code: { type: 'string', minLength: 1 },
            state: { type: 'string', minLength: 32 },
          },
        },
        response: {
          201: oauthCallbackResponseSchema,
          400: connectionErrorResponseSchema,
          401: connectionErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuthenticatedUserId(request);
      const query = gitLabCallbackQuerySchema.parse(request.query);
      const pending = request.session.gitlabOAuth;
      delete request.session.gitlabOAuth;
      const connection = await options.authorizationService.completeGitLabAuthorization({
        userId,
        code: query.code,
        state: query.state,
        pending,
      });
      return reply.status(201).send({ success: true, data: { connectionId: connection.id } });
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Connections'],
        summary: 'List Git connections',
        description: 'Lists only connections owned by the authenticated user.',
        response: {
          200: connectionListResponseSchema,
          401: connectionErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const userId = requireAuthenticatedUserId(request);
      const connections = await options.connectionService.list(userId);
      return { success: true, data: connections };
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Connections'],
        summary: 'Disconnect a Git provider',
        description: 'Deletes a connection only when it belongs to the authenticated user.',
        params: connectionIdParamsJsonSchema,
        response: {
          204: { type: 'null', description: 'Connection removed' },
          400: connectionErrorResponseSchema,
          401: connectionErrorResponseSchema,
          404: connectionErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuthenticatedUserId(request);
      const { id } = connectionParamsSchema.parse(request.params);
      await options.connectionService.disconnect(id, userId);
      return reply.status(204).send();
    },
  );
}
