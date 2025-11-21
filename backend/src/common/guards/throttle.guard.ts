import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number; // Max requests
  ttl: number; // Time window in seconds
}

/**
 * Guard to throttle requests based on IP address
 * Prevents abuse by limiting request rate
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private requests: Map<string, number[]> = new Map();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const throttle = this.reflector.get<ThrottleOptions>(THROTTLE_KEY, context.getHandler());

    if (!throttle) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIp(request);
    const now = Date.now();
    const windowStart = now - throttle.ttl * 1000;

    // Get or initialize request history for this IP
    let requestTimes = this.requests.get(ip) || [];

    // Filter out requests outside the time window
    requestTimes = requestTimes.filter((time) => time > windowStart);

    // Check if limit exceeded
    if (requestTimes.length >= throttle.limit) {
      const oldestRequest = requestTimes[0];
      const retryAfter = Math.ceil((oldestRequest + throttle.ttl * 1000 - now) / 1000);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add current request
    requestTimes.push(now);
    this.requests.set(ip, requestTimes);

    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Clean up old entries periodically
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [ip, times] of this.requests.entries()) {
      const recentTimes = times.filter((time) => time > now - maxAge);

      if (recentTimes.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, recentTimes);
      }
    }
  }
}
