import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type CommentDocument = Comment & Document;

export enum CommentTargetType {
  EVENT = 'event',
  SUBMISSION = 'submission',
  USER = 'user',
}

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: String, enum: CommentTargetType, required: true })
  targetType: CommentTargetType;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true })
  authorAddress: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  parentId?: string; // for nested comments

  @Prop({ type: [String], default: [] })
  mentions: string[]; // wallet addresses

  @Prop({ type: [String], default: [] })
  likedBy: string[]; // wallet addresses

  @Prop({ default: 0 })
  likeCount: number;

  @Prop({ default: 0 })
  replyCount: number;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ type: [String], default: [] })
  flags: string[]; // reasons for flagging

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Indexes
CommentSchema.index({ targetType: 1, targetId: 1 });
CommentSchema.index({ authorAddress: 1 });
CommentSchema.index({ parentId: 1 });
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ likeCount: -1 });
CommentSchema.index({ isPinned: 1, createdAt: -1 });
CommentSchema.index({ isDeleted: 1 });

