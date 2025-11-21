import { Injectable, Logger } from '@nestjs/common';

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: 'success' | 'failure';
  error?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private logs: AuditLog[] = [];
  private nextLogId: number = 0;

  /**
   * Log audit event
   */
  async log(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata?: {
      changes?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      status?: 'success' | 'failure';
      error?: string;
    }
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: `audit-${this.nextLogId++}`,
      userId,
      action,
      resource,
      resourceId,
      changes: metadata?.changes,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      timestamp: new Date(),
      status: metadata?.status || 'success',
      error: metadata?.error,
    };

    this.logs.push(auditLog);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    this.logger.log(
      `Audit: ${userId} ${action} ${resource}/${resourceId} - ${auditLog.status}`
    );
  }

  /**
   * Get logs by user
   */
  getLogsByUser(userId: string, limit: number = 100): AuditLog[] {
    return this.logs
      .filter((log) => log.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get logs by resource
   */
  getLogsByResource(
    resource: string,
    resourceId: string,
    limit: number = 100
  ): AuditLog[] {
    return this.logs
      .filter(
        (log) => log.resource === resource && log.resourceId === resourceId
      )
      .slice(-limit)
      .reverse();
  }

  /**
   * Get logs by action
   */
  getLogsByAction(action: string, limit: number = 100): AuditLog[] {
    return this.logs
      .filter((log) => log.action === action)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): AuditLog[] {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Get failed operations
   */
  getFailedOperations(limit: number = 100): AuditLog[] {
    return this.logs
      .filter((log) => log.status === 'failure')
      .slice(-limit)
      .reverse();
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    total: number;
    success: number;
    failure: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
  } {
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};

    for (const log of this.logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResource[log.resource] = (byResource[log.resource] || 0) + 1;
    }

    return {
      total: this.logs.length,
      success: this.logs.filter((l) => l.status === 'success').length,
      failure: this.logs.filter((l) => l.status === 'failure').length,
      byAction,
      byResource,
    };
  }

  /**
   * Clear old logs
   */
  clearOldLogs(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const before = this.logs.length;
    this.logs = this.logs.filter((log) => log.timestamp >= cutoffDate);

    const removed = before - this.logs.length;
    this.logger.log(`Cleared ${removed} old audit logs`);

    return removed;
  }

  /**
   * Export logs
   */
  exportLogs(): AuditLog[] {
    return [...this.logs];
  }
}

export default AuditService;

