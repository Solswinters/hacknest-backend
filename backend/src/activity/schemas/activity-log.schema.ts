import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

export enum ActivityAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGGED_IN = 'user_logged_in',
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  EVENT_DELETED = 'event_deleted',
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_UPDATED = 'submission_updated',
  SUBMISSION_DELETED = 'submission_deleted',
  TEAM_CREATED = 'team_created',
  TEAM_JOINED = 'team_joined',
  TEAM_LEFT = 'team_left',
  PRIZE_AWARDED = 'prize_awarded',
  PAYOUT_INITIATED = 'payout_initiated',
  PAYOUT_COMPLETED = 'payout_completed',
  COMMENT_ADDED = 'comment_added',
  VOTE_CAST = 'vote_cast',
}

@Schema({ collection: 'activity_logs' })
export class ActivityLog {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: string;

  @Prop({ required: true, enum: ActivityAction })
  action: ActivityAction;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ type: Object })
  details?: Record<string, any>;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Date, default: Date.now, expires: '90d' }) // Auto-delete after 90 days
  createdAt: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

// Indexes
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ entityType: 1, entityId: 1 });
ActivityLogSchema.index({ createdAt: -1 });

