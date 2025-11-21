import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueOptions {
  maxConcurrency?: number;
  defaultPriority?: number;
  defaultMaxAttempts?: number;
  retryDelay?: number;
}

@Injectable()
export class QueueService extends EventEmitter {
  private readonly logger = new Logger(QueueService.name);
  private queue: QueueJob[] = [];
  private processing: Set<string> = new Set();
  private nextJobId = 0;
  private isRunning = false;

  constructor(private readonly options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrency: 5,
      defaultPriority: 0,
      defaultMaxAttempts: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Add a job to the queue
   */
  async add<T>(data: T, options: Partial<QueueJob> = {}): Promise<string> {
    const jobId = `job-${this.nextJobId++}`;

    const job: QueueJob<T> = {
      id: jobId,
      data,
      priority: options.priority ?? this.options.defaultPriority!,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? this.options.defaultMaxAttempts!,
      delay: options.delay ?? 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.sortQueue();

    this.emit('job:added', job);
    this.logger.debug(`Job ${jobId} added to queue`);

    if (!this.isRunning) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    while (this.queue.length > 0 && this.processing.size < this.options.maxConcurrency!) {
      const job = this.getNextJob();
      if (!job) break;

      this.processJob(job);
    }

    if (this.processing.size === 0) {
      this.isRunning = false;
    }
  }

  /**
   * Get next job from queue
   */
  private getNextJob(): QueueJob | null {
    const now = new Date();

    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];

      // Check if job delay has passed
      if (job.delay > 0) {
        const delayEnd = new Date(job.createdAt.getTime() + job.delay);
        if (now < delayEnd) continue;
      }

      // Remove from queue and return
      this.queue.splice(i, 1);
      return job;
    }

    return null;
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    this.processing.add(job.id);
    job.processedAt = new Date();
    job.attempts++;

    this.emit('job:processing', job);
    this.logger.debug(`Processing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);

    try {
      // Emit job for external handlers
      const result = await this.executeJob(job);

      job.completedAt = new Date();
      this.processing.delete(job.id);

      this.emit('job:completed', job, result);
      this.logger.debug(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      job.error = error instanceof Error ? error.message : String(error);

      if (job.attempts < job.maxAttempts) {
        // Retry job
        job.delay = this.options.retryDelay! * job.attempts;
        this.queue.push(job);
        this.sortQueue();

        this.emit('job:retry', job);
        this.logger.debug(`Job ${job.id} will be retried (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      } else {
        // Job failed permanently
        job.failedAt = new Date();
        this.emit('job:failed', job, error);
        this.logger.error(`Job ${job.id} failed permanently after ${job.attempts} attempts`);
      }

      this.processing.delete(job.id);
    }

    // Continue processing
    this.processQueue();
  }

  /**
   * Execute job (to be overridden or handled by event listeners)
   */
  private async executeJob(job: QueueJob): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Job execution timeout'));
      }, 30000); // 30 second timeout

      this.emit('job:execute', job, (error: Error | null, result?: any) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get queue status
   */
  getStatus(): {
    pending: number;
    processing: number;
    total: number;
  } {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size,
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.queue.find((job) => job.id === jobId);
  }

  /**
   * Remove job from queue
   */
  removeJob(jobId: string): boolean {
    const index = this.queue.findIndex((job) => job.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('job:removed', jobId);
      return true;
    }
    return false;
  }

  /**
   * Clear all pending jobs
   */
  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    this.emit('queue:cleared', count);
    this.logger.log(`Cleared ${count} pending jobs from queue`);
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isRunning = false;
    this.emit('queue:paused');
    this.logger.log('Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.isRunning) {
      this.emit('queue:resumed');
      this.logger.log('Queue processing resumed');
      this.processQueue();
    }
  }
}
