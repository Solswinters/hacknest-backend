import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorsMiddleware.name);
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly configService: ConfigService) {
    // Load allowed origins from environment
    const origins = this.configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map(origin => origin.trim());
    
    this.allowedOrigins = new Set(origins);
    this.logger.log(`CORS configured with origins: ${Array.from(this.allowedOrigins).join(', ')}`);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && (this.allowedOrigins.has(origin) || this.allowedOrigins.has('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key'
      );
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    } else if (origin) {
      this.logger.warn(`CORS request from unauthorized origin: ${origin}`);
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  }
}

