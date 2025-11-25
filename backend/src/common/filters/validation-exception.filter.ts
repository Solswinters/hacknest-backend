import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';

import { Response } from 'express';

/**
 * Global exception filter for validation errors
 * Provides consistent error responses for validation failures
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract validation errors
    const errors = this.extractErrors(exceptionResponse);

    // Log validation error
    this.logger.warn(`Validation error: ${JSON.stringify(errors)}`);

    // Send formatted response
    response.status(status).json({
      statusCode: status,
      error: 'Validation Error',
      message: 'One or more validation errors occurred',
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Extract validation errors from exception response
   */
  private extractErrors(exceptionResponse: any): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    if (typeof exceptionResponse === 'object' && exceptionResponse.message) {
      const messages = Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message
        : [exceptionResponse.message];

      messages.forEach((message: string) => {
        // Parse class-validator error format: "property message"
        const parts = message.split(' ');
        const property = parts[0];
        const errorMessage = parts.slice(1).join(' ');

        if (!errors[property]) {
          errors[property] = [];
        }

        errors[property].push(errorMessage);
      });
    }

    return errors;
  }
}

