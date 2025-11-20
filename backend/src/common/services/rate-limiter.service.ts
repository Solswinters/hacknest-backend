import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  blockDuration?: number; // How long to block after exceeding limit
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
  blocked: boolean;
}

interface RequestRecord {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private records: Map<string, RequestRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old records every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request should be allowed
   */
  checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): { allowed: boolean; info: RateLimitInfo } {
    const now = Date.now();
    const record = this.records.get(identifier);

    // Check if currently blocked
    if (record?.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        info: {
          limit: config.maxRequests,
          current: record.count,
          remaining: 0,
          resetTime: record.blockedUntil,
          blocked: true,
        },
      };
    }

    // Initialize or reset record if window has passed
    if (!record || now - record.firstRequest >= config.windowMs) {
      this.records.set(identifier, {
        count: 1,
        firstRequest: now,
      });

      return {
        allowed: true,
        info: {
          limit: config.maxRequests,
          current: 1,
          remaining: config.maxRequests - 1,
          resetTime: now + config.windowMs,
          blocked: false,
        },
      };
    }

    // Increment count
    record.count++;

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      // Block if configured
      if (config.blockDuration) {
        record.blockedUntil = now + config.blockDuration;
      }

      this.logger.warn(
        `Rate limit exceeded for ${identifier}. Count: ${record.count}/${config.maxRequests}`
      );

      return {
        allowed: false,
        info: {
          limit: config.maxRequests,
          current: record.count,
          remaining: 0,
          resetTime: record.firstRequest + config.windowMs,
          blocked: !!config.blockDuration,
        },
      };
    }

    return {
      allowed: true,
      info: {
        limit: config.maxRequests,
        current: record.count,
        remaining: config.maxRequests - record.count,
        resetTime: record.firstRequest + config.windowMs,
        blocked: false,
      },
    };
  }

  /**
   * Reset limit for identifier
   */
  reset(identifier: string): void {
    this.records.delete(identifier);
    this.logger.debug(`Rate limit reset for ${identifier}`);
  }

  /**
   * Get current limit info
   */
  getInfo(identifier: string, config: RateLimitConfig): RateLimitInfo {
    const record = this.records.get(identifier);
    const now = Date.now();

    if (!record) {
      return {
        limit: config.maxRequests,
        current: 0,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        blocked: false,
      };
    }

    const isBlocked = record.blockedUntil ? now < record.blockedUntil : false;

    return {
      limit: config.maxRequests,
      current: record.count,
      remaining: Math.max(0, config.maxRequests - record.count),
      resetTime: record.firstRequest + config.windowMs,
      blocked: isBlocked,
    };
  }

  /**
   * Cleanup old records
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, record] of this.records.entries()) {
      // Remove records older than 1 hour
      if (now - record.firstRequest > 3600000) {
        this.records.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old rate limit records`);
    }
  }

  /**
   * Get all records (for debugging)
   */
  getAllRecords(): Map<string, RequestRecord> {
    return new Map(this.records);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalIdentifiers: number;
    blockedIdentifiers: number;
    totalRecords: number;
  } {
    const now = Date.now();
    let blocked = 0;

    for (const record of this.records.values()) {
      if (record.blockedUntil && now < record.blockedUntil) {
        blocked++;
      }
    }

    return {
      totalIdentifiers: this.records.size,
      blockedIdentifiers: blocked,
      totalRecords: this.records.size,
    };
  }

  /**
   * Clear all records
   */
  clearAll(): void {
    this.records.clear();
    this.logger.log('All rate limit records cleared');
  }

  /**
   * Destroy service (cleanup)
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Rate Limit Strategies
 */
export class RateLimitStrategies {
  // Very strict - API endpoints that modify data
  static readonly STRICT: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 10,
    blockDuration: 300000, // 5 minutes
  };

  // Moderate - General API endpoints
  static readonly MODERATE: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 60,
    blockDuration: 60000, // 1 minute
  };

  // Lenient - Read-only endpoints
  static readonly LENIENT: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 120,
  };

  // Authentication - Login attempts
  static readonly AUTH: RateLimitConfig = {
    windowMs: 900000, // 15 minutes
    maxRequests: 5,
    blockDuration: 900000, // 15 minutes
  };

  // Password reset
  static readonly PASSWORD_RESET: RateLimitConfig = {
    windowMs: 3600000, // 1 hour
    maxRequests: 3,
    blockDuration: 3600000, // 1 hour
  };

  // Email sending
  static readonly EMAIL: RateLimitConfig = {
    windowMs: 3600000, // 1 hour
    maxRequests: 10,
  };

  // File upload
  static readonly UPLOAD: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 5,
    blockDuration: 60000, // 1 minute
  };

  // API key generation
  static readonly API_KEY: RateLimitConfig = {
    windowMs: 3600000, // 1 hour
    maxRequests: 5,
  };

  // Search queries
  static readonly SEARCH: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 30,
  };

  // Webhook calls
  static readonly WEBHOOK: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  };
}

/**
 * Rate Limit Decorator Factory
 */
export function createRateLimitDecorator(config: RateLimitConfig) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // This is a placeholder - actual implementation would use the service
      // and extract identifier from request context
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();

  check(identifier: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing requests
    let timestamps = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= config.maxRequests) {
      return false;
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  cleanup(): void {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour

    for (const [identifier, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((ts) => ts > cutoff);

      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter {
  private buckets: Map<
    string,
    { tokens: number; lastRefill: number }
  > = new Map();

  check(
    identifier: string,
    capacity: number,
    refillRate: number,
    refillInterval: number
  ): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = { tokens: capacity - 1, lastRefill: now };
      this.buckets.set(identifier, bucket);
      return true;
    }

    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / refillInterval) * refillRate;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have tokens
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  reset(identifier: string): void {
    this.buckets.delete(identifier);
  }
}

/**
 * Distributed Rate Limiter (using Redis in production)
 */
export class DistributedRateLimiter {
  // Placeholder for Redis-based distributed rate limiting
  // In production, this would use Redis to share rate limit state across instances

  async check(
    identifier: string,
    config: RateLimitConfig
  ): Promise<boolean> {
    // TODO: Implement Redis-based rate limiting
    // For now, return true
    return true;
  }

  async reset(identifier: string): Promise<void> {
    // TODO: Implement Redis reset
  }

  async getInfo(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    // TODO: Implement Redis-based info retrieval
    return {
      limit: config.maxRequests,
      current: 0,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      blocked: false,
    };
  }
}

export default RateLimiterService;

