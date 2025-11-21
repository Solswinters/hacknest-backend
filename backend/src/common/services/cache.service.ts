import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number;
  onEvict?: (key: string, value: any) => void;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number = 3600; // 1 hour
  private readonly maxSize: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Set cache value
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    this.logger.debug(`Cache set: ${key}`);
  }

  /**
   * Get cache value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return entry.value as T;
  }

  /**
   * Get or set cache value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);

    if (deleted) {
      this.logger.debug(`Cache delete: ${key}`);
    }

    return deleted;
  }

  /**
   * Delete multiple entries
   */
  deleteMany(keys: string[]): number {
    let deleted = 0;

    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Delete by pattern
   */
  deleteByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deleted++;
      }
    }

    this.logger.debug(`Cache delete by pattern: ${pattern}, deleted ${deleted} entries`);

    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    keys: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entries = Array.from(this.cache.values());

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: this.cache.size,
      oldestEntry:
        entries.length > 0
          ? Math.min(...entries.map((e) => e.createdAt))
          : null,
      newestEntry:
        entries.length > 0
          ? Math.max(...entries.map((e) => e.createdAt))
          : null,
    };
  }

  /**
   * Get TTL for key
   */
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const ttl = Math.floor((entry.expiresAt - Date.now()) / 1000);

    return ttl > 0 ? ttl : 0;
  }

  /**
   * Update TTL for key
   */
  updateTTL(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    entry.expiresAt = Date.now() + ttl * 1000;

    return true;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.logger.debug(`Evicted oldest entry: ${oldestKey}`);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    this.logger.log('Cache cleanup interval started');
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Cache cleanup interval stopped');
    }
  }

  /**
   * Wrap function with cache
   */
  wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    return this.getOrSet(key, fn, ttl);
  }

  /**
   * Get cache hit rate (for monitoring)
   */
  getHitRate(): number {
    // This would require tracking hits/misses
    // For now, return 0
    return 0;
  }

  /**
   * Export cache data
   */
  export(): Record<string, any> {
    const data: Record<string, any> = {};

    for (const [key, entry] of this.cache.entries()) {
      data[key] = {
        value: entry.value,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt,
      };
    }

    return data;
  }

  /**
   * Import cache data
   */
  import(data: Record<string, any>): void {
    for (const [key, entry] of Object.entries(data)) {
      this.cache.set(key, entry as CacheEntry<any>);
    }

    this.logger.log(`Imported ${Object.keys(data).length} cache entries`);
  }
}

export default CacheService;

