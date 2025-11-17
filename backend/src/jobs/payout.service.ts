import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument, JobType, JobStatus } from './schemas/job.schema';
import { ContractService } from '../web3/contract.service';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

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
   * Process a single payout job
   */
  async processJob(jobId: string): Promise<JobDocument> {
    const job = await this.jobModel.findById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== JobStatus.PENDING) {
      this.logger.warn(`Job ${jobId} is not pending, skipping`);
      return job;
    }

    // Update status to processing
    job.status = JobStatus.PROCESSING;
    await job.save();

    try {
      this.logger.log(`Processing payout job: ${jobId}`);

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
        job.status = JobStatus.COMPLETED;
        job.result = {
          txHash: result.txHash,
          processedAt: new Date(),
        };
        this.logger.log(`Payout job completed: ${jobId}, tx: ${result.txHash}`);
      } else {
        throw new Error(result.error || 'Payout failed');
      }
    } catch (error) {
      this.logger.error(`Payout job failed: ${jobId}, error: ${error.message}`);
      job.status = JobStatus.FAILED;
      job.result = {
        error: error.message,
        processedAt: new Date(),
      };
    }

    return job.save();
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
}

