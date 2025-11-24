import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  method: string;
  correlationId?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        error = responseObj.error || error;
        
        // Include validation errors if present
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Include stack trace in development
      if (this.isDevelopment) {
        details = {
          stack: exception.stack,
          name: exception.name,
        };
      }
    }

    // Sanitize message for security
    const sanitizedMessage = this.sanitizeMessage(message);

    // Generate correlation ID for tracking
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Log error details with correlation ID
    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} - Status: ${status} - Message: ${JSON.stringify(sanitizedMessage)}`,
      exception instanceof Error ? exception.stack : '',
    );

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      error,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
    };

    // Add details in development mode
    if (this.isDevelopment && details) {
      errorResponse.details = details;
    }

    response.status(status).json(errorResponse);
  }

  private sanitizeMessage(message: unknown): string | string[] {
    if (Array.isArray(message)) {
      return message.map((m) => this.sanitizeString(String(m)));
    }
    return this.sanitizeString(String(message));
  }

  private sanitizeString(str: string): string {
    // Remove sensitive information patterns
    return str
      .replace(/password[^&\s]*/gi, 'password=***')
      .replace(/token[^&\s]*/gi, 'token=***')
      .replace(/key[^&\s]*/gi, 'key=***')
      .replace(/secret[^&\s]*/gi, 'secret=***');
  }
}

