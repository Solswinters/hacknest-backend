import { Injectable, Logger } from '@nestjs/common';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, QueueJob[]> = new Map();
  private processors: Map<string, (job: QueueJob) => Promise<void>> = new Map();
  private processing: Set<string> = new Set();
  private nextJobId: number = 0;

  /**
   * Add job to queue
   */
  async add<T>(
    queueName: string,
    data: T,
    options: { priority?: number; maxAttempts?: number } = {}
  ): Promise<string> {
    const jobId = `job-${this.nextJobId++}`;

    const job: QueueJob<T> = {
      id: jobId,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      status: 'pending',
      createdAt: new Date(),
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;
    queue.push(job);

    // Sort by priority
    queue.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Job ${jobId} added to queue ${queueName}`);

    // Process queue
    this.processQueue(queueName);

    return jobId;
  }

  /**
   * Register processor
   */
  registerProcessor(
    queueName: string,
    processor: (job: QueueJob) => Promise<void>
  ): void {
    this.processors.set(queueName, processor);
    this.logger.log(`Processor registered for queue: ${queueName}`);
  }

  /**
   * Process queue
   */
  private async processQueue(queueName: string): Promise<void> {
    if (this.processing.has(queueName)) {
      return;
    }

    const queue = this.queues.get(queueName);
    const processor = this.processors.get(queueName);

    if (!queue || !processor) {
      return;
    }

    this.processing.add(queueName);

    while (queue.length > 0) {
      const job = queue.find((j) => j.status === 'pending');

      if (!job) {
        break;
      }

      job.status = 'processing';
      job.attempts++;

      try {
        await processor(job);
        job.status = 'completed';
        job.processedAt = new Date();
        this.logger.log(`Job ${job.id} completed in queue ${queueName}`);

        // Remove completed job
        const index = queue.indexOf(job);
        if (index > -1) {
          queue.splice(index, 1);
        }
      } catch (error: any) {
        this.logger.error(
          `Job ${job.id} failed in queue ${queueName}: ${error.message}`
        );

        job.error = error.message;

        if (job.attempts >= job.maxAttempts) {
          job.status = 'failed';
          this.logger.error(`Job ${job.id} failed permanently`);

          // Remove failed job
          const index = queue.indexOf(job);
          if (index > -1) {
            queue.splice(index, 1);
          }
        } else {
          job.status = 'pending';
          this.logger.warn(
            `Job ${job.id} will be retried (${job.attempts}/${job.maxAttempts})`
          );
        }
      }
    }

    this.processing.delete(queueName);
  }

  /**
   * Get job by ID
   */
  getJob(queueName: string, jobId: string): QueueJob | undefined {
    const queue = this.queues.get(queueName);
    return queue?.find((j) => j.id === jobId);
  }

  /**
   * Get queue size
   */
  getQueueSize(queueName: string): number {
    return this.queues.get(queueName)?.length || 0;
  }

  /**
   * Get pending jobs
   */
  getPendingJobs(queueName: string): QueueJob[] {
    const queue = this.queues.get(queueName);
    return queue?.filter((j) => j.status === 'pending') || [];
  }

  /**
   * Get processing jobs
   */
  getProcessingJobs(queueName: string): QueueJob[] {
    const queue = this.queues.get(queueName);
    return queue?.filter((j) => j.status === 'processing') || [];
  }

  /**
   * Clear queue
   */
  clear(queueName: string): void {
    this.queues.delete(queueName);
    this.logger.log(`Queue ${queueName} cleared`);
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get queue stats
   */
  getQueueStats(queueName: string): {
    total: number;
    pending: number;
    processing: number;
  } {
    const queue = this.queues.get(queueName) || [];

    return {
      total: queue.length,
      pending: queue.filter((j) => j.status === 'pending').length,
      processing: queue.filter((j) => j.status === 'processing').length,
    };
  }
}

export default QueueService;

