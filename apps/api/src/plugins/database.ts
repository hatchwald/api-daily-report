import { PrismaPg } from '@prisma/adapter-pg';
import type { FastifyInstance } from 'fastify';

import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function registerDatabaseShutdown(app: FastifyInstance, prisma: PrismaClient): void {
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
