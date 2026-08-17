import type { GitProviderName } from '../../providers/git-provider.interface.js';

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface ConnectionSummary {
  id: string;
  provider: GitProviderName;
  baseUrl: string;
  providerUsername: string;
  installationId: string | null;
  status: ConnectionStatus;
  createdAt: Date;
}
