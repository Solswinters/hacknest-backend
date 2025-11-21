import { Injectable, Logger } from '@nestjs/common';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, Metric[]> = new Map();
  private readonly maxMetricsPerName: number = 1000;

  /**
   * Record metric
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // Keep only recent metrics
    if (metricList.length > this.maxMetricsPerName) {
      metricList.shift();
    }

    this.logger.debug(`Metric recorded: ${name} = ${value}`);
  }

  /**
   * Increment counter
   */
  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  /**
   * Decrement counter
   */
  decrement(name: string, tags?: Record<string, string>): void {
    this.record(name, -1, tags);
  }

  /**
   * Record timing
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record(`${name}.duration`, duration, tags);
  }

  /**
   * Get metric stats
   */
  getStats(name: string, since?: Date): MetricStats | null {
    const metricList = this.metrics.get(name);

    if (!metricList || metricList.length === 0) {
      return null;
    }

    let filtered = metricList;

    if (since) {
      filtered = metricList.filter((m) => m.timestamp >= since);
    }

    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: filtered.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / filtered.length,
    };
  }

  /**
   * Get recent metrics
   */
  getRecent(name: string, limit: number = 100): Metric[] {
    const metricList = this.metrics.get(name);

    if (!metricList) {
      return [];
    }

    return metricList.slice(-limit);
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      this.logger.log(`Metrics cleared for: ${name}`);
    } else {
      this.metrics.clear();
      this.logger.log('All metrics cleared');
    }
  }

  /**
   * Get metric count
   */
  getMetricCount(name: string): number {
    return this.metrics.get(name)?.length || 0;
  }

  /**
   * Get metrics by tag
   */
  getMetricsByTag(
    name: string,
    tagKey: string,
    tagValue: string
  ): Metric[] {
    const metricList = this.metrics.get(name);

    if (!metricList) {
      return [];
    }

    return metricList.filter(
      (m) => m.tags && m.tags[tagKey] === tagValue
    );
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, MetricStats> {
    const summary: Record<string, MetricStats> = {};

    for (const name of this.getMetricNames()) {
      const stats = this.getStats(name);
      if (stats) {
        summary[name] = stats;
      }
    }

    return summary;
  }

  /**
   * Export metrics
   */
  export(): Record<string, Metric[]> {
    const exported: Record<string, Metric[]> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      exported[name] = [...metrics];
    }

    return exported;
  }

  /**
   * Measure execution time
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.timing(name, duration, tags);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.timing(name, duration, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Get percentile
   */
  getPercentile(name: string, percentile: number): number | null {
    const metricList = this.metrics.get(name);

    if (!metricList || metricList.length === 0) {
      return null;
    }

    const values = metricList.map((m) => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;

    return values[index];
  }
}

export default MetricsService;

