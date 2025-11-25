import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  EVENT_REMINDER = 'event_reminder',
  TEAM_INVITATION = 'team_invitation',
  SUBMISSION_FEEDBACK = 'submission_feedback',
  PRIZE_AWARDED = 'prize_awarded',
  PAYOUT_STATUS = 'payout_status',
  NEW_COMMENT = 'new_comment',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

@Schema({ collection: 'notifications' })
export class Notification {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  recipientId: string;

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  data?: Record<string, any>;

  @Prop()
  link?: string;

  @Prop({ type: Boolean, default: false })
  read: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, read: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ createdAt: -1 });

// TTL index to auto-delete old notifications after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

