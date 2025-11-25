import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobType {
  PAYOUT = 'payout',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Job {
  @Prop({
    type: String,
    enum: Object.values(JobType),
    required: true,
    index: true,
  })
  type: JobType;

  @Prop({ type: Object, required: true })
  payload: {
    eventId: Types.ObjectId;
    winners: Array<{ address: string; amount: string }>;
    initiatedBy: string;
  };

  @Prop({
    type: String,
    enum: Object.values(JobStatus),
    default: JobStatus.PENDING,
    index: true,
  })
  status: JobStatus;

  @Prop({ type: Object })
  result?: {
    txHash?: string;
    error?: string;
    processedAt?: Date;
  };
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Index for job processing
JobSchema.index({ status: 1, type: 1 });
JobSchema.index({ 'payload.eventId': 1 });

