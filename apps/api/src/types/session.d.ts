import '@fastify/session';

declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: string;
    githubInstallationState?: string;
    gitlabOAuth?: {
      state: string;
      codeVerifier: string;
      baseUrl: string;
    };
  }
}
