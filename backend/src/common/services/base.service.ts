import { Logger } from '@nestjs/common';

/**
 * Base Service - Abstract base class for service layer separation
 * Provides common functionality and enforces consistent patterns
 */
export abstract class BaseService {
  protected readonly logger: Logger;
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
  }

  /**
   * Log info message
   */
  protected logInfo(message: string, context?: Record<string, any>): void {
    this.logger.log(message, context);
  }

  /**
   * Log debug message
   */
  protected logDebug(message: string, context?: Record<string, any>): void {
    this.logger.debug(message, context);
  }

  /**
   * Log warning
   */
  protected logWarning(message: string, context?: Record<string, any>): void {
    this.logger.warn(message, context);
  }

  /**
   * Log error
   */
  protected logError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logger.error(message, error?.stack, context);
  }

  /**
   * Validate required fields
   */
  protected validateRequired<T>(
    data: T,
    fields: (keyof T)[],
  ): void {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Handle service error
   */
  protected handleError(error: Error, operation: string): never {
    this.logError(`${operation} failed`, error);
    throw error;
  }

  /**
   * Measure execution time
   */
  protected async measureTime<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.logDebug(`${operation} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logError(`${operation} failed after ${duration}ms`, error as Error);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          const backoff = delay * Math.pow(2, attempt - 1);
          this.logWarning(`Attempt ${attempt} failed, retrying in ${backoff}ms`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  /**
   * Sanitize data for logging
   */
  protected sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

export default BaseService;

