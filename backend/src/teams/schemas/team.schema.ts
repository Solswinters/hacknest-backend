import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeamDocument = Team & Document;

export interface TeamMember {
  userId: string;
  role: 'owner' | 'member';
  joinedAt: Date;
}

export interface TeamInvitation {
  id: string;
  userId: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt?: Date;
}

@Schema({ collection: 'teams' })
export class Team {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Event' })
  eventId: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId: string;

  @Prop({ type: [Object], default: [] })
  members: TeamMember[];

  @Prop({ type: [Object], default: [] })
  invitations: TeamInvitation[];

  @Prop({ type: Number, default: 5 })
  maxMembers: number;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Indexes
TeamSchema.index({ name: 1 });
TeamSchema.index({ eventId: 1 });
TeamSchema.index({ ownerId: 1 });
TeamSchema.index({ 'members.userId': 1 });
TeamSchema.index({ createdAt: -1 });
TeamSchema.index({ eventId: 1, name: 1 }, { unique: true });
