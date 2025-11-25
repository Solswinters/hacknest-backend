import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

export enum CommentEntityType {
  EVENT = 'event',
  SUBMISSION = 'submission',
  USER = 'user',
  TEAM = 'team',
  ANNOUNCEMENT = 'announcement',
}

@Schema({ collection: 'comments' })
export class Comment {
  @Prop({ required: true, enum: CommentEntityType })
  entityType: CommentEntityType;

  @Prop({ required: true })
  entityId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  authorId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'Comment' })
  parentCommentId?: string;

  @Prop({ type: [String], default: [] })
  likes: string[];

  @Prop({ type: Boolean, default: false })
  isPinned: boolean;

  @Prop({ type: Boolean, default: false })
  isReported: boolean;

  @Prop()
  reportReason?: string;

  @Prop({ type: Boolean, default: false })
  isEdited: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Indexes
CommentSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
CommentSchema.index({ authorId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1 });
CommentSchema.index({ isPinned: 1 });
CommentSchema.index({ isReported: 1 });

