import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiKeyMiddleware.name);
  private readonly validApiKeys: Set<string>;

  constructor(private readonly configService: ConfigService) {
    // Load valid API keys from environment
    const apiKeys = this.configService.get<string>('API_KEYS', '').split(',').filter(Boolean);
    this.validApiKeys = new Set(apiKeys);
    
    if (this.validApiKeys.size === 0) {
      this.logger.warn('No API keys configured. API key validation will be skipped.');
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip if no API keys are configured
    if (this.validApiKeys.size === 0) {
      return next();
    }

    // Extract API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    if (!this.validApiKeys.has(apiKey)) {
      this.logger.warn(`Invalid API key attempted: ${apiKey.substring(0, 8)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    this.logger.debug('Valid API key provided');
    next();
  }
}

