import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  EVENT_CREATED = 'event_created',
  EVENT_STARTED = 'event_started',
  EVENT_ENDING_SOON = 'event_ending_soon',
  EVENT_ENDED = 'event_ended',
  SUBMISSION_RECEIVED = 'submission_received',
  JUDGING_ASSIGNED = 'judging_assigned',
  JUDGING_COMPLETED = 'judging_completed',
  SCORE_RECEIVED = 'score_received',
  WINNER_ANNOUNCED = 'winner_announced',
  PAYOUT_INITIATED = 'payout_initiated',
  PAYOUT_COMPLETED = 'payout_completed',
  TEAM_INVITE = 'team_invite',
  TEAM_MEMBER_JOINED = 'team_member_joined',
  SPONSOR_ADDED = 'sponsor_added',
  PRIZE_AWARDED = 'prize_awarded',
  COMMENT_RECEIVED = 'comment_received',
  MENTION = 'mention',
  SYSTEM = 'system',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  recipientAddress: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  link?: string;

  @Prop({ type: Object })
  data?: Record<string, any>;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt?: Date;

  @Prop()
  senderAddress?: string;

  @Prop()
  eventId?: string;

  @Prop()
  submissionId?: string;

  @Prop({ default: false })
  emailSent: boolean;

  @Prop()
  emailSentAt?: Date;

  @Prop({ default: false })
  pushSent: boolean;

  @Prop()
  pushSentAt?: Date;

  @Prop()
  expiresAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ recipientAddress: 1, read: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ eventId: 1 });
NotificationSchema.index({ submissionId: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

