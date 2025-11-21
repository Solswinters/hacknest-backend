/**
 * Event Logger Middleware - Comprehensive event logging for observability
 * Improves system monitoring and debugging capabilities
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface LogEvent {
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  correlationId?: string;
  error?: string;
}

@Injectable()
export class EventLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EventLoggerMiddleware.name);
  private events: LogEvent[] = [];
  private readonly maxEvents = 1000;

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    // Attach correlation ID to request
    (req as any).correlationId = correlationId;

    // Log request
    this.logger.log(
      `[${correlationId}] ${req.method} ${req.path} - Request received`
    );

    // Capture response
    const originalSend = res.send;
    const self = this;

    res.send = function (data: any): Response {
      const duration = Date.now() - startTime;
      const event: LogEvent = {
        timestamp: new Date(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId: (req as any).user?.id,
        userAgent: req.get('user-agent'),
        ip: req.ip || req.socket.remoteAddress,
        correlationId,
      };

      // Add error if status code indicates error
      if (res.statusCode >= 400) {
        try {
          const parsedData = JSON.parse(data);
          event.error = parsedData.message || 'Unknown error';
        } catch {
          // Data is not JSON
        }
      }

      // Store event
      self.storeEvent(event);

      // Log response
      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';
      self.logger[logLevel](
        `[${correlationId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );

      return originalSend.call(this, data);
    };

    next();
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private storeEvent(event: LogEvent): void {
    this.events.push(event);

    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Get all stored events
   */
  public getEvents(): LogEvent[] {
    return [...this.events];
  }

  /**
   * Get events by time range
   */
  public getEventsByTimeRange(start: Date, end: Date): LogEvent[] {
    return this.events.filter(
      (event) => event.timestamp >= start && event.timestamp <= end
    );
  }

  /**
   * Get events by user
   */
  public getEventsByUser(userId: string): LogEvent[] {
    return this.events.filter((event) => event.userId === userId);
  }

  /**
   * Get events by status code
   */
  public getEventsByStatusCode(statusCode: number): LogEvent[] {
    return this.events.filter((event) => event.statusCode === statusCode);
  }

  /**
   * Get error events
   */
  public getErrorEvents(): LogEvent[] {
    return this.events.filter((event) => event.statusCode >= 400);
  }

  /**
   * Get slow requests
   */
  public getSlowRequests(threshold: number = 1000): LogEvent[] {
    return this.events.filter((event) => event.duration >= threshold);
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    totalRequests: number;
    averageDuration: number;
    errorRate: number;
    statusCodeDistribution: Record<number, number>;
  } {
    const totalRequests = this.events.length;
    const totalDuration = this.events.reduce((sum, e) => sum + e.duration, 0);
    const errorCount = this.events.filter((e) => e.statusCode >= 400).length;

    const statusCodeDistribution: Record<number, number> = {};
    for (const event of this.events) {
      statusCodeDistribution[event.statusCode] =
        (statusCodeDistribution[event.statusCode] || 0) + 1;
    }

    return {
      totalRequests,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      statusCodeDistribution,
    };
  }

  /**
   * Clear all events
   */
  public clearEvents(): void {
    this.events = [];
  }
}

