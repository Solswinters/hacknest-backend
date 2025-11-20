import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly requests: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    maxRequests: number = 100,
    windowMs: number = 60000, // 1 minute
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Get client identifier (IP address or user ID)
    const clientId = this.getClientId(req);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = this.requests.get(clientId);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.requests.set(clientId, entry);
    } else {
      // Increment count
      entry.count++;

      if (entry.count > this.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        
        this.logger.warn(
          `Rate limit exceeded for ${clientId}. Requests: ${entry.count}/${this.maxRequests}`,
        );

        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Set rate limit headers
    const remaining = Math.max(0, this.maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

    next();
  }

  private getClientId(req: Request): string {
    // Try to get user address from authenticated request
    const user = (req as any).user;
    if (user?.address) {
      return `user:${user.address}`;
    }

    // Fall back to IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.socket.remoteAddress;

    return `ip:${ip}`;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

