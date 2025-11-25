import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';

import { Model, Types } from 'mongoose';

import { ContractService } from '../web3/contract.service';
import { Job, JobDocument, JobType, JobStatus } from './schemas/job.schema';

interface PayoutRetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

interface PayoutMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  totalAmount: string;
}

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly retryConfig: PayoutRetryConfig = {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    backoffMultiplier: 2,
  };

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    private contractService: ContractService,
  ) {}

  /**
   * Enqueue a payout job
   */
  async enqueuePayout(
    eventId: string,
    winners: Array<{ address: string; amount: string }>,
    initiatedBy: string,
  ): Promise<JobDocument> {
    const job = new this.jobModel({
      type: JobType.PAYOUT,
      status: JobStatus.PENDING,
      payload: {
        eventId: new Types.ObjectId(eventId),
        winners,
        initiatedBy,
      },
    });

    const savedJob = await job.save();
    this.logger.log(
      `Payout job enqueued: ${savedJob._id} for event ${eventId}`,
    );

    return savedJob;
  }

  /**
   * Process a single payout job with retry logic
   */
  async processJob(jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.FAILED) {
      this.logger.warn(`Job ${jobId} is not pending or failed, skipping`);
      return job;
    }

    // Update status to processing
    job.status = JobStatus.PROCESSING;
    const startTime = Date.now();
    await job.save();

    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        this.logger.log(
          `Processing payout job: ${jobId} (attempt ${retryCount + 1}/${this.retryConfig.maxRetries + 1})`,
        );

        const { eventId, winners } = job.payload;

        // Extract addresses and amounts
        const addresses = winners.map((w: any) => w.address);
        const amounts = winners.map((w: any) => w.amount);

        // For MVP, we'll use a mock event address or the eventId as address
        // In production, this should come from the event's contractAddress
        const eventAddress = `0x${eventId.toString().padEnd(40, '0')}`;

        // Execute payout via contract service
        const result = await this.contractService.payout({
          eventAddress,
          winners: addresses,
          amounts,
        });

        if (result.success) {
          const processingTime = Date.now() - startTime;
          job.status = JobStatus.COMPLETED;
          job.result = {
            txHash: result.txHash,
            processedAt: new Date(),
            processingTime,
            retryCount,
          };
          this.logger.log(
            `Payout job completed: ${jobId}, tx: ${result.txHash}, time: ${processingTime}ms`,
          );
          return job.save();
        } else {
          throw new Error(result.error || 'Payout failed');
        }
      } catch (error) {
        lastError = error;
        retryCount++;

        if (retryCount <= this.retryConfig.maxRetries) {
          const delay =
            this.retryConfig.retryDelay *
            Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1);
          this.logger.warn(
            `Payout job ${jobId} failed (attempt ${retryCount}), retrying in ${delay}ms...`,
          );
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    const processingTime = Date.now() - startTime;
    this.logger.error(
      `Payout job failed after ${retryCount} attempts: ${jobId}, error: ${lastError?.message}`,
    );
    job.status = JobStatus.FAILED;
    job.result = {
      error: lastError?.message || 'Unknown error',
      processedAt: new Date(),
      processingTime,
      retryCount,
    };

    return job.save();
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process all pending payout jobs
   */
  async processPendingPayouts(): Promise<void> {
    const pendingJobs = await this.jobModel
      .find({ status: JobStatus.PENDING })
      .sort({ createdAt: 1 })
      .limit(10)
      .exec();

    this.logger.log(`Found ${pendingJobs.length} pending payout job(s)`);

    for (const job of pendingJobs) {
      await this.processJob(job._id.toString());
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return job;
  }

  /**
   * Get jobs by event
   */
  async getJobsByEvent(eventId: string): Promise<JobDocument[]> {
    return this.jobModel
      .find({ 'payload.eventId': new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get all jobs with optional status filter
   */
  async getAllJobs(status?: JobStatus): Promise<JobDocument[]> {
    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    return this.jobModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== JobStatus.FAILED) {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    this.logger.log(`Retrying failed job: ${jobId}`);
    job.status = JobStatus.PENDING;
    await job.save();

    return this.processJob(jobId);
  }

  /**
   * Cancel a pending or processing job
   */
  async cancelJob(jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (
      job.status !== JobStatus.PENDING &&
      job.status !== JobStatus.PROCESSING
    ) {
      throw new Error(`Job ${jobId} cannot be cancelled (status: ${job.status})`);
    }

    this.logger.log(`Cancelling job: ${jobId}`);
    job.status = JobStatus.FAILED;
    job.result = {
      error: 'Job cancelled by user',
      processedAt: new Date(),
    };

    return job.save();
  }

  /**
   * Get payout metrics for an event
   */
  async getPayoutMetrics(eventId: string): Promise<PayoutMetrics> {
    const jobs = await this.getJobsByEvent(eventId);

    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(
      (job) => job.status === JobStatus.COMPLETED,
    ).length;
    const failedJobs = jobs.filter(
      (job) => job.status === JobStatus.FAILED,
    ).length;

    let totalProcessingTime = 0;
    let totalAmount = BigInt(0);

    for (const job of jobs) {
      if (job.result?.processingTime) {
        totalProcessingTime += job.result.processingTime;
      }

      if (job.payload?.winners) {
        for (const winner of job.payload.winners) {
          totalAmount += BigInt(winner.amount || 0);
        }
      }
    }

    const averageProcessingTime =
      successfulJobs > 0 ? totalProcessingTime / successfulJobs : 0;

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      averageProcessingTime,
      totalAmount: totalAmount.toString(),
    };
  }

  /**
   * Get transaction details by transaction hash
   */
  async getTransactionDetails(txHash: string): Promise<JobDocument | null> {
    return this.jobModel.findOne({ 'result.txHash': txHash }).exec();
  }

  /**
   * Retry all failed jobs for a specific event
   */
  async retryAllFailedJobsForEvent(eventId: string): Promise<number> {
    const failedJobs = await this.jobModel
      .find({
        'payload.eventId': new Types.ObjectId(eventId),
        status: JobStatus.FAILED,
      })
      .exec();

    this.logger.log(
      `Retrying ${failedJobs.length} failed job(s) for event ${eventId}`,
    );

    let successCount = 0;
    for (const job of failedJobs) {
      try {
        await this.retryFailedJob(job._id.toString());
        successCount++;
      } catch (error) {
        this.logger.error(
          `Failed to retry job ${job._id}: ${error.message}`,
        );
      }
    }

    return successCount;
  }

  /**
   * Get jobs by status and date range
   */
  async getJobsByStatusAndDateRange(
    status: JobStatus,
    startDate: Date,
    endDate: Date,
  ): Promise<JobDocument[]> {
    return this.jobModel
      .find({
        status,
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}

