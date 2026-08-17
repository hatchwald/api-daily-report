import 'dotenv/config';

import { buildApp } from './app.js';
import { loadEnvironment } from './config/env.js';

async function startServer(): Promise<void> {
  const environment = loadEnvironment();
  const app = await buildApp(environment);

  try {
    await app.listen({ host: environment.HOST, port: environment.PORT });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void startServer();
