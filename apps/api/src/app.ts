import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import session from '@fastify/session';
import Fastify, { type FastifyInstance } from 'fastify';

import type { Environment } from './config/env.js';
import { PrismaUserRepository, type UserRepository } from './modules/auth/auth.repository.js';
import { authRoutes } from './modules/auth/auth.route.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ConnectionAuthorizationService } from './modules/connections/connection-auth.service.js';
import {
  PrismaConnectionRepository,
  type ConnectionRepository,
} from './modules/connections/connection.repository.js';
import { connectionRoutes } from './modules/connections/connection.route.js';
import { ConnectionService } from './modules/connections/connection.service.js';
import {
  InMemoryReportGenerationLock,
  type ReportGenerationLock,
} from './modules/reports/report-lock.js';
import {
  PrismaReportRepository,
  type ReportRepository,
} from './modules/reports/report.repository.js';
import { reportRoutes } from './modules/reports/report.route.js';
import { ReportService } from './modules/reports/report.service.js';
import {
  PrismaRepositoryRepository,
  type RepositoryRepository,
} from './modules/repositories/repository.repository.js';
import { repositoryRoutes } from './modules/repositories/repository.route.js';
import { RepositoryService } from './modules/repositories/repository.service.js';
import { healthRoutes } from './modules/system/health.route.js';
import { createPrismaClient, registerDatabaseShutdown } from './plugins/database.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerSwagger } from './plugins/swagger.js';
import { GitHubAppJwtIssuer } from './providers/github/github-app-jwt.js';
import {
  DefaultProviderAuthorizationClient,
  type ProviderAuthorizationClient,
} from './providers/provider-authorization.client.js';
import { ProviderHttpClient } from './providers/provider-http-client.js';
import {
  DefaultReportActivityClient,
  type ReportActivityClient,
} from './providers/report-activity.client.js';
import {
  DefaultRepositoryProviderClient,
  type RepositoryProviderClient,
} from './providers/repository-provider.client.js';
import { CredentialEncryption } from './shared/security/credential-encryption.js';

interface BuildAppOptions {
  userRepository?: UserRepository;
  connectionRepository?: ConnectionRepository;
  providerAuthorizationClient?: ProviderAuthorizationClient;
  repositoryRepository?: RepositoryRepository;
  repositoryProviderClient?: RepositoryProviderClient;
  reportRepository?: ReportRepository;
  reportActivityClient?: ReportActivityClient;
  reportGenerationLock?: ReportGenerationLock;
}

export async function buildApp(
  environment: Environment,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: environment.NODE_ENV !== 'test',
    requestTimeout: environment.REQUEST_TIMEOUT_MS,
    requestIdHeader: 'x-request-id',
  });

  await registerSwagger(app);
  await app.register(helmet);
  await app.register(cookie);
  await app.register(session, {
    secret: environment.SESSION_SECRET,
    cookieName: 'daily_report_session',
    cookie: {
      httpOnly: true,
      secure: environment.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    },
    saveUninitialized: false,
  });
  await app.register(cors, {
    origin: environment.FRONTEND_URL,
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  let userRepository = options.userRepository;
  let connectionRepository = options.connectionRepository;
  let repositoryRepository = options.repositoryRepository;
  let reportRepository = options.reportRepository;
  if (!userRepository || !connectionRepository || !repositoryRepository || !reportRepository) {
    const prisma = createPrismaClient(environment.DATABASE_URL);
    registerDatabaseShutdown(app, prisma);
    userRepository ??= new PrismaUserRepository(prisma);
    connectionRepository ??= new PrismaConnectionRepository(prisma);
    repositoryRepository ??= new PrismaRepositoryRepository(prisma);
    reportRepository ??= new PrismaReportRepository(prisma);
  }

  registerErrorHandler(app);
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, {
    prefix: '/api/v1/auth',
    authService: new AuthService(userRepository),
  });
  await app.register(connectionRoutes, {
    prefix: '/api/v1/connections',
    connectionService: new ConnectionService(connectionRepository),
    frontendOrigin: new URL(environment.FRONTEND_URL).origin,
    authorizationService: new ConnectionAuthorizationService(
      connectionRepository,
      options.providerAuthorizationClient ??
        new DefaultProviderAuthorizationClient(
          new ProviderHttpClient(environment.PROVIDER_REQUEST_TIMEOUT_MS),
          {
            githubAppId: environment.GITHUB_APP_ID,
            githubPrivateKey: environment.GITHUB_PRIVATE_KEY,
            gitlabClientId: environment.GITLAB_CLIENT_ID,
            gitlabClientSecret: environment.GITLAB_CLIENT_SECRET,
            gitlabRedirectUri: environment.GITLAB_REDIRECT_URI,
          },
        ),
      new CredentialEncryption(environment.CREDENTIAL_ENCRYPTION_KEY),
      {
        githubAppSlug: environment.GITHUB_APP_SLUG,
        gitlabClientId: environment.GITLAB_CLIENT_ID,
        gitlabRedirectUri: environment.GITLAB_REDIRECT_URI,
        gitlabAllowedBaseUrls: environment.GITLAB_ALLOWED_BASE_URLS,
      },
    ),
  });
  const providerHttpClient = new ProviderHttpClient(environment.PROVIDER_REQUEST_TIMEOUT_MS);
  await app.register(repositoryRoutes, {
    prefix: '/api/v1/repositories',
    repositoryService: new RepositoryService(
      connectionRepository,
      repositoryRepository,
      options.repositoryProviderClient ??
        new DefaultRepositoryProviderClient(
          providerHttpClient,
          new GitHubAppJwtIssuer(environment.GITHUB_APP_ID, environment.GITHUB_PRIVATE_KEY),
        ),
      new CredentialEncryption(environment.CREDENTIAL_ENCRYPTION_KEY),
    ),
  });
  await app.register(reportRoutes, {
    prefix: '/api/v1/reports',
    reportService: new ReportService(
      reportRepository,
      connectionRepository,
      repositoryRepository,
      options.reportActivityClient ??
        new DefaultReportActivityClient(
          providerHttpClient,
          new GitHubAppJwtIssuer(environment.GITHUB_APP_ID, environment.GITHUB_PRIVATE_KEY),
        ),
      new CredentialEncryption(environment.CREDENTIAL_ENCRYPTION_KEY),
      options.reportGenerationLock ?? new InMemoryReportGenerationLock(),
    ),
  });

  return app;
}
