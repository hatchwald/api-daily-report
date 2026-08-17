import type { GitProviderName } from '../../providers/git-provider.interface.js';

export interface RepositoryRecord {
  id: string;
  connectionId: string;
  provider: GitProviderName;
  externalId: string;
  name: string;
  fullName: string;
  url: string | null;
  enabled: boolean;
  updatedAt: Date;
}

export interface RepositoryPage {
  items: RepositoryRecord[];
  total: number;
  page: number;
  limit: number;
}
