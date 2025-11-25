import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

export enum ActivityType {
  USER_REGISTERED = 'user_registered',
  USER_UPDATED = 'user_updated',
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  EVENT_DELETED = 'event_deleted',
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_UPDATED = 'submission_updated',
  SUBMISSION_SCORED = 'submission_scored',
  JUDGE_INVITED = 'judge_invited',
  JUDGE_REMOVED = 'judge_removed',
  PAYOUT_INITIATED = 'payout_initiated',
  PAYOUT_COMPLETED = 'payout_completed',
  PAYOUT_FAILED = 'payout_failed',
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
  TEAM_DISBANDED = 'team_disbanded',
  SPONSOR_ADDED = 'sponsor_added',
  SPONSOR_UPDATED = 'sponsor_updated',
  PRIZE_AWARDED = 'prize_awarded',
  PRIZE_CLAIMED = 'prize_claimed',
}

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: String, enum: ActivityType, required: true })
  type: ActivityType;

  @Prop({ required: true })
  actor: string; // wallet address or system

  @Prop()
  targetType?: string; // event, submission, user, etc.

  @Prop()
  targetId?: string;

  @Prop()
  description: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Object })
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  correlationId?: string;

  @Prop({ default: false })
  isSystem: boolean;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// Indexes
ActivityLogSchema.index({ type: 1 });
ActivityLogSchema.index({ actor: 1 });
ActivityLogSchema.index({ targetType: 1, targetId: 1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ correlationId: 1 });
ActivityLogSchema.index({ isSystem: 1 });

// TTL index - auto-delete logs after 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

