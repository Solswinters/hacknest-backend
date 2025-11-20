import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface ThrottleConfig {
  limit: number;
  ttl: number; // Time to live in seconds
}

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly requestCounts: Map<
    string,
    { count: number; resetTime: number }
  > = new Map();

  constructor(private reflector: Reflector) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  canActivate(context: ExecutionContext): boolean {
    const throttleConfig = this.reflector.getAllAndOverride<ThrottleConfig>(
      'throttle',
      [context.getHandler(), context.getClass()]
    );

    if (!throttleConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const identifier = this.getIdentifier(request);
    const now = Date.now();

    let record = this.requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
      // Create new record
      record = {
        count: 1,
        resetTime: now + throttleConfig.ttl * 1000,
      };
      this.requestCounts.set(identifier, record);
      return true;
    }

    if (record.count >= throttleConfig.limit) {
      const remainingTime = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.count++;
    return true;
  }

  private getIdentifier(request: any): string {
    // Use user ID if authenticated, otherwise use IP address
    const userId = request.user?.id;
    const ip =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;

    return userId || ip;
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, record] of this.requestCounts.entries()) {
      if (now > record.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }

  // Method to manually reset rate limit for a user
  reset(identifier: string): void {
    this.requestCounts.delete(identifier);
  }

  // Method to get current count for a user
  getCount(identifier: string): number {
    const record = this.requestCounts.get(identifier);
    return record ? record.count : 0;
  }
}

export default ThrottleGuard;

