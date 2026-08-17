import { ApplicationError } from '../../shared/errors/application-error.js';

import type { ConnectionRepository } from './connection.repository.js';
import type { ConnectionSummary } from './connection.types.js';

export class ConnectionService {
  public constructor(private readonly connections: ConnectionRepository) {}

  public list(userId: string): Promise<ConnectionSummary[]> {
    return this.connections.findAllOwnedByUser(userId);
  }

  public async disconnect(connectionId: string, userId: string): Promise<void> {
    const deleted = await this.connections.deleteOwnedByUser(connectionId, userId);
    if (!deleted) {
      throw new ApplicationError('NOT_FOUND', 'Git connection was not found.', 404);
    }
  }
}
