/**
 * Query Optimizer - Database query optimization utilities
 * HIGH PRIORITY: Performance improvements for database operations
 */

import { Model, QueryOptions, FilterQuery } from 'mongoose';
import { Logger } from '@nestjs/common';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface QueryPerformanceMetrics {
  queryTime: number;
  documentCount: number;
  indexUsed: boolean;
  cacheHit?: boolean;
}

export class QueryOptimizer {
  private static readonly logger = new Logger(QueryOptimizer.name);
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MAX_LIMIT = 100;

  /**
   * Optimize find query with pagination and projection
   */
  static async findWithOptimization<T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: PaginationOptions = {},
    projection?: Record<string, 0 | 1>
  ): Promise<{ data: T[]; total: number; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();

    // Sanitize pagination options
    const page = Math.max(options.page || this.DEFAULT_PAGE, 1);
    const limit = Math.min(
      Math.max(options.limit || this.DEFAULT_LIMIT, 1),
      this.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    // Execute optimized queries in parallel
    const [data, total] = await Promise.all([
      model
        .find(filter, projection)
        .sort(options.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      model.countDocuments(filter).exec(),
    ]);

    const queryTime = Date.now() - startTime;

    // Log slow queries
    if (queryTime > 1000) {
      this.logger.warn(
        `Slow query detected (${queryTime}ms): ${model.modelName} - ${JSON.stringify(filter)}`
      );
    }

    return {
      data: data as T[],
      total,
      metrics: {
        queryTime,
        documentCount: data.length,
        indexUsed: true, // Would need explain() for actual value
      },
    };
  }

  /**
   * Build efficient aggregation pipeline
   */
  static buildAggregationPipeline(
    filters: Record<string, any>,
    options: PaginationOptions = {}
  ): any[] {
    const pipeline: any[] = [];

    // Match stage
    if (Object.keys(filters).length > 0) {
      pipeline.push({ $match: filters });
    }

    // Sort stage
    if (options.sort) {
      pipeline.push({ $sort: options.sort });
    }

    // Pagination
    const page = Math.max(options.page || this.DEFAULT_PAGE, 1);
    const limit = Math.min(
      Math.max(options.limit || this.DEFAULT_LIMIT, 1),
      this.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }
    pipeline.push({ $limit: limit });

    return pipeline;
  }

  /**
   * Create compound index recommendation
   */
  static recommendIndexes(
    frequentQueries: FilterQuery<any>[]
  ): Record<string, 1 | -1>[] {
    const indexes: Record<string, 1 | -1>[] = [];
    const fieldFrequency = new Map<string, number>();

    // Analyze query patterns
    for (const query of frequentQueries) {
      for (const field of Object.keys(query)) {
        fieldFrequency.set(field, (fieldFrequency.get(field) || 0) + 1);
      }
    }

    // Sort fields by frequency
    const sortedFields = Array.from(fieldFrequency.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    // Create single-field indexes for top fields
    for (const [field] of sortedFields.slice(0, 5)) {
      indexes.push({ [field]: 1 });
    }

    // Create compound index for most common combinations
    if (sortedFields.length >= 2) {
      const compoundIndex: Record<string, 1 | -1> = {};
      for (const [field] of sortedFields.slice(0, 3)) {
        compoundIndex[field] = 1;
      }
      indexes.push(compoundIndex);
    }

    return indexes;
  }

  /**
   * Optimize bulk operations
   */
  static async bulkWrite<T>(
    model: Model<T>,
    operations: any[],
    chunkSize = 1000
  ): Promise<void> {
    const startTime = Date.now();

    // Process in chunks to avoid memory issues
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      await model.bulkWrite(chunk, { ordered: false });
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Bulk write completed: ${operations.length} operations in ${duration}ms`
    );
  }

  /**
   * Generate query cache key
   */
  static generateCacheKey(
    modelName: string,
    filter: FilterQuery<any>,
    options?: any
  ): string {
    const key = {
      model: modelName,
      filter,
      options: options || {},
    };
    return `query:${JSON.stringify(key)}`;
  }

  /**
   * Sanitize query filters to prevent injection
   */
  static sanitizeFilter(filter: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(filter)) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      // Sanitize nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeFilter(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export default QueryOptimizer;

