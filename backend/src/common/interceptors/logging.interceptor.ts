import {

  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface RequestLog {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  correlationId: string;
  timestamp: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers, ip } = request;
    const now = Date.now();

    // Generate or use existing correlation ID
    const correlationId =
      (headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Attach correlation ID to response header
    context.switchToHttp().getResponse().setHeader('x-correlation-id', correlationId);

    // Build request log
    const requestLog: RequestLog = {
      method,
      url,
      userAgent: headers['user-agent'],
      ip: ip || headers['x-forwarded-for'],
      correlationId,
      timestamp: new Date().toISOString(),
    };

    // Log request with correlation ID
    this.logger.log(`➡️  [${correlationId}] ${method} ${url}`);

    // Log sanitized body in debug mode
    if (process.env.NODE_ENV === 'development' && body && Object.keys(body).length > 0) {
      const sanitizedBody = this.sanitizeObject(body);
      this.logger.debug(
        `[${correlationId}] Request body: ${JSON.stringify(sanitizedBody)}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          const statusCode = response.statusCode;

          // Log response with performance metrics
          this.logger.log(
            `⬅️  [${correlationId}] ${method} ${url} - ${statusCode} - ${delay}ms`,
          );

          // Warn on slow requests (>1000ms)
          if (delay > 1000) {
            this.logger.warn(
              `🐌 Slow request detected [${correlationId}]: ${method} ${url} took ${delay}ms`,
            );
          }

          // Log response body in debug mode for non-GET requests
          if (
            process.env.NODE_ENV === 'development' &&
            method !== 'GET' &&
            data
          ) {
            this.logger.debug(
              `[${correlationId}] Response: ${JSON.stringify(data).substring(0, 200)}`,
            );
          }
        },
        error: (error) => {
          const delay = Date.now() - now;
          const status = error.status || 500;

          this.logger.error(
            `❌ [${correlationId}] ${method} ${url} - ${status} - ${delay}ms - ${error.message}`,
          );

          // Log error stack in development
          if (process.env.NODE_ENV === 'development' && error.stack) {
            this.logger.debug(`[${correlationId}] Stack trace: ${error.stack}`);
          }
        },
      }),
    );
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.sensitiveFields.some((sensitive) =>
      lowerField.includes(sensitive),
    );
  }
}

