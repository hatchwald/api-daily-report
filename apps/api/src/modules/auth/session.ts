import type { FastifySessionObject } from '@fastify/session';

export async function regenerateSession(session: FastifySessionObject): Promise<void> {
  await session.regenerate();
}

export async function destroySession(session: FastifySessionObject): Promise<void> {
  await session.destroy();
}
