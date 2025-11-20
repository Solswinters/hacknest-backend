import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestValidationMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate content type for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        if (!contentType) {
          throw new BadRequestException('Content-Type header is required');
        }

        if (!contentType.includes('application/json')) {
          throw new BadRequestException('Content-Type must be application/json');
        }
      }

      // Validate request body size (already handled by body-parser, but we can add custom logic)
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const length = parseInt(contentLength, 10);
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (length > maxSize) {
          throw new BadRequestException('Request body too large');
        }
      }

      // Sanitize query parameters
      if (req.query) {
        this.sanitizeObject(req.query);
      }

      // Sanitize body
      if (req.body) {
        this.sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      this.logger.warn(`Request validation failed: ${error.message}`);
      throw error;
    }
  }

  private sanitizeObject(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        // Remove potentially dangerous keys
        if (key.startsWith('$') || key.startsWith('_') || key.includes('.')) {
          delete obj[key];
          continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
          this.sanitizeObject(value);
        }

        // Sanitize strings to prevent XSS
        if (typeof value === 'string') {
          obj[key] = this.sanitizeString(value);
        }
      }
    }
  }

  private sanitizeString(str: string): string {
    // Remove potentially dangerous characters
    return str
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
}

