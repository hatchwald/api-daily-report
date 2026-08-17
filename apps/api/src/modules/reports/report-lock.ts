export interface ReportGenerationLock {
  acquire(userId: string): Promise<boolean>;
  release(userId: string): Promise<void>;
}

export class InMemoryReportGenerationLock implements ReportGenerationLock {
  private readonly activeUsers = new Set<string>();

  public acquire(userId: string): Promise<boolean> {
    if (this.activeUsers.has(userId)) return Promise.resolve(false);
    this.activeUsers.add(userId);
    return Promise.resolve(true);
  }

  public release(userId: string): Promise<void> {
    this.activeUsers.delete(userId);
    return Promise.resolve();
  }
}
