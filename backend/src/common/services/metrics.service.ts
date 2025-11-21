import { Injectable, Logger } from '@nestjs/common';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface Counter {
  count: number;
  lastUpdated: Date;
}

export interface Histogram {
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timings: Map<string, number[]> = new Map();

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const counter = this.counters.get(key) || { count: 0, lastUpdated: new Date() };

    counter.count += value;
    counter.lastUpdated = new Date();

    this.counters.set(key, counter);
  }

  /**
   * Decrement a counter
   */
  decrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.incrementCounter(name, -value, tags);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const values = this.histograms.get(key) || [];

    values.push(value);

    // Keep last 1000 values
    if (values.length > 1000) {
      values.shift();
    }

    this.histograms.set(key, values);
  }

  /**
   * Record a timing (in milliseconds)
   */
  recordTiming(name: string, duration: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const timings = this.timings.get(key) || [];

    timings.push(duration);

    // Keep last 1000 timings
    if (timings.length > 1000) {
      timings.shift();
    }

    this.timings.set(key, timings);
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordTiming(name, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTiming(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Time a sync function execution
   */
  timeSync<T>(name: string, fn: () => T, tags?: Record<string, string>): T {
    const start = Date.now();

    try {
      const result = fn();
      const duration = Date.now() - start;
      this.recordTiming(name, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordTiming(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Get counter value
   */
  getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.buildKey(name, tags);
    return this.counters.get(key)?.count || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, tags?: Record<string, string>): number | undefined {
    const key = this.buildKey(name, tags);
    return this.gauges.get(key);
  }

  /**
   * Get histogram stats
   */
  getHistogram(name: string, tags?: Record<string, string>): Histogram | null {
    const key = this.buildKey(name, tags);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) return null;

    return this.calculateHistogramStats(values);
  }

  /**
   * Get timing stats
   */
  getTimingStats(name: string, tags?: Record<string, string>): Histogram | null {
    const key = this.buildKey(name, tags);
    const values = this.timings.get(key);

    if (!values || values.length === 0) return null;

    return this.calculateHistogramStats(values);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): {
    counters: Record<string, Counter>;
    gauges: Record<string, number>;
    histograms: Record<string, Histogram>;
    timings: Record<string, Histogram>;
  } {
    const counters: Record<string, Counter> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, Histogram> = {};
    const timings: Record<string, Histogram> = {};

    this.counters.forEach((value, key) => {
      counters[key] = value;
    });

    this.gauges.forEach((value, key) => {
      gauges[key] = value;
    });

    this.histograms.forEach((values, key) => {
      const stats = this.calculateHistogramStats(values);
      if (stats) histograms[key] = stats;
    });

    this.timings.forEach((values, key) => {
      const stats = this.calculateHistogramStats(values);
      if (stats) timings[key] = stats;
    });

    return { counters, gauges, histograms, timings };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timings.clear();
    this.logger.log('All metrics reset');
  }

  /**
   * Reset specific metric
   */
  resetMetric(name: string, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    this.counters.delete(key);
    this.gauges.delete(key);
    this.histograms.delete(key);
    this.timings.delete(key);
  }

  /**
   * Build metric key from name and tags
   */
  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');

    return `${name}{${tagString}}`;
  }

  /**
   * Calculate histogram statistics
   */
  private calculateHistogramStats(values: number[]): Histogram {
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      values: sorted,
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: this.getPercentile(sorted, 50),
      p95: sorted[p95Index],
      p99: sorted[p99Index],
    };
  }

  /**
   * Get percentile value
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.floor((sortedValues.length * percentile) / 100);
    return sortedValues[index];
  }

  /**
   * Log metrics summary
   */
  logSummary(): void {
    const metrics = this.getAllMetrics();

    this.logger.log('=== Metrics Summary ===');
    this.logger.log(`Counters: ${Object.keys(metrics.counters).length}`);
    this.logger.log(`Gauges: ${Object.keys(metrics.gauges).length}`);
    this.logger.log(`Histograms: ${Object.keys(metrics.histograms).length}`);
    this.logger.log(`Timings: ${Object.keys(metrics.timings).length}`);

    // Log top timings
    const topTimings = Object.entries(metrics.timings)
      .sort(([, a], [, b]) => b.mean - a.mean)
      .slice(0, 10);

    if (topTimings.length > 0) {
      this.logger.log('Top 10 Slowest Operations:');
      topTimings.forEach(([name, stats]) => {
        this.logger.log(
          `  ${name}: mean=${stats.mean.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, p99=${stats.p99.toFixed(2)}ms`,
        );
      });
    }
  }
}
