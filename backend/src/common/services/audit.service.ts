/**
 * Audit Service - Comprehensive audit logging for compliance and security
 * HIGH PRIORITY: Track all critical operations for security and compliance
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export interface AuditLog {
  timestamp: Date;
  userId?: string;
  userAddress?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
  statusCode: number;
  duration: number;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: AuditCategory;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  DATA_DELETION = 'data_deletion',
  CONFIGURATION = 'configuration',
  SECURITY = 'security',
  PAYMENT = 'payment',
  USER_MANAGEMENT = 'user_management',
  SYSTEM = 'system',
}

export interface AuditQueryOptions {
  userId?: string;
  userAddress?: string;
  action?: string;
  resource?: string;
  category?: AuditCategory;
  severity?: AuditLog['severity'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalLogs: number;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<string, number>;
  byResult: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  failureRate: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly buffer: AuditLog[] = [];
  private readonly bufferLimit = 100;
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectModel('AuditLog')
    private readonly auditLogModel: Model<AuditLog>
  ) {
    // Flush buffer periodically
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Every 5 seconds
  }

  /**
   * Log an audit entry
   */
  async log(entry: Partial<AuditLog>): Promise<void> {
    const auditLog: AuditLog = {
      timestamp: new Date(),
      action: entry.action || 'unknown',
      resource: entry.resource || 'unknown',
      resourceId: entry.resourceId,
      method: entry.method || 'unknown',
      path: entry.path || 'unknown',
      ip: entry.ip || 'unknown',
      userAgent: entry.userAgent,
      statusCode: entry.statusCode || 0,
      duration: entry.duration || 0,
      userId: entry.userId,
      userAddress: entry.userAddress,
      changes: entry.changes,
      metadata: entry.metadata,
      severity: entry.severity || 'low',
      category: entry.category || AuditCategory.SYSTEM,
      result: entry.result || 'success',
      errorMessage: entry.errorMessage,
    };

    // Add to buffer
    this.buffer.push(auditLog);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferLimit) {
      await this.flushBuffer();
    }

    // Log critical events immediately
    if (auditLog.severity === 'critical') {
      this.logger.warn(
        `CRITICAL AUDIT: ${auditLog.action} by ${auditLog.userId || 'anonymous'} on ${auditLog.resource}`
      );
      await this.flushBuffer();
    }
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    userId: string,
    action: 'login' | 'logout' | 'register' | 'verify',
    result: AuditLog['result'],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'authentication',
      category: AuditCategory.AUTHENTICATION,
      severity: result === 'failure' ? 'high' : 'medium',
      result,
      metadata,
    });
  }

  /**
   * Log authorization event
   */
  async logAuthorization(
    userId: string,
    action: string,
    resource: string,
    result: AuditLog['result'],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      category: AuditCategory.AUTHORIZATION,
      severity: result === 'failure' ? 'medium' : 'low',
      result,
      metadata,
    });
  }

  /**
   * Log data access
   */
  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: 'read',
      resource,
      resourceId,
      category: AuditCategory.DATA_ACCESS,
      severity: 'low',
      result: 'success',
      metadata,
    });
  }

  /**
   * Log data modification
   */
  async logDataModification(
    userId: string,
    resource: string,
    resourceId: string,
    changes: { before?: any; after?: any },
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: 'update',
      resource,
      resourceId,
      category: AuditCategory.DATA_MODIFICATION,
      severity: 'medium',
      result: 'success',
      changes,
      metadata,
    });
  }

  /**
   * Log data deletion
   */
  async logDataDeletion(
    userId: string,
    resource: string,
    resourceId: string,
    changes: { before?: any },
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action: 'delete',
      resource,
      resourceId,
      category: AuditCategory.DATA_DELETION,
      severity: 'high',
      result: 'success',
      changes,
      metadata,
    });
  }

  /**
   * Log payment transaction
   */
  async logPayment(
    userId: string,
    action: string,
    amount: number,
    result: AuditLog['result'],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'payment',
      category: AuditCategory.PAYMENT,
      severity: 'critical',
      result,
      metadata: {
        ...metadata,
        amount,
      },
    });
  }

  /**
   * Log security event
   */
  async logSecurity(
    action: string,
    severity: AuditLog['severity'],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action,
      resource: 'security',
      category: AuditCategory.SECURITY,
      severity,
      result: 'success',
      metadata,
    });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions): Promise<AuditLog[]> {
    const filter: any = {};

    if (options.userId) filter.userId = options.userId;
    if (options.userAddress) filter.userAddress = options.userAddress;
    if (options.action) filter.action = options.action;
    if (options.resource) filter.resource = options.resource;
    if (options.category) filter.category = options.category;
    if (options.severity) filter.severity = options.severity;

    if (options.startDate || options.endDate) {
      filter.timestamp = {};
      if (options.startDate) filter.timestamp.$gte = options.startDate;
      if (options.endDate) filter.timestamp.$lte = options.endDate;
    }

    return this.auditLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(options.limit || 100)
      .skip(options.offset || 0)
      .exec();
  }

  /**
   * Get audit statistics
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditStatistics> {
    const filter: any = {};

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }

    const logs = await this.auditLogModel.find(filter).exec();

    const stats: AuditStatistics = {
      totalLogs: logs.length,
      byCategory: {} as Record<AuditCategory, number>,
      bySeverity: {},
      byResult: {},
      topUsers: [],
      topActions: [],
      failureRate: 0,
    };

    // Initialize counters
    Object.values(AuditCategory).forEach((category) => {
      stats.byCategory[category as AuditCategory] = 0;
    });

    const userCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    let failures = 0;

    logs.forEach((log) => {
      // Count by category
      stats.byCategory[log.category] =
        (stats.byCategory[log.category] || 0) + 1;

      // Count by severity
      stats.bySeverity[log.severity] =
        (stats.bySeverity[log.severity] || 0) + 1;

      // Count by result
      stats.byResult[log.result] = (stats.byResult[log.result] || 0) + 1;

      // Track failures
      if (log.result === 'failure') failures++;

      // Count by user
      if (log.userId) {
        userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
      }

      // Count by action
      actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
    });

    // Calculate failure rate
    stats.failureRate = logs.length > 0 ? failures / logs.length : 0;

    // Get top users
    stats.topUsers = Array.from(userCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Get top actions
    stats.topActions = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return stats;
  }

  /**
   * Export audit logs
   */
  async exportLogs(
    options: AuditQueryOptions,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const logs = await this.query(options);

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      // CSV format
      const headers = [
        'timestamp',
        'userId',
        'action',
        'resource',
        'resourceId',
        'severity',
        'category',
        'result',
      ];

      const rows = logs.map((log) =>
        headers.map((h) => log[h as keyof AuditLog] || '').join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }
  }

  /**
   * Flush buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer.length = 0;

    try {
      await this.auditLogModel.insertMany(logsToFlush);
      this.logger.debug(`Flushed ${logsToFlush.length} audit logs`);
    } catch (error) {
      this.logger.error('Failed to flush audit logs', error);
      // Re-add to buffer if failed
      this.buffer.push(...logsToFlush);
    }
  }

  /**
   * Archive old logs
   */
  async archiveLogs(olderThan: Date): Promise<number> {
    const result = await this.auditLogModel
      .deleteMany({ timestamp: { $lt: olderThan } })
      .exec();

    this.logger.log(`Archived ${result.deletedCount} old audit logs`);
    return result.deletedCount || 0;
  }

  /**
   * Clear all logs (use with caution!)
   */
  async clearLogs(): Promise<void> {
    await this.auditLogModel.deleteMany({}).exec();
    this.logger.warn('All audit logs cleared');
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushBuffer();
  }
}

export default AuditService;
