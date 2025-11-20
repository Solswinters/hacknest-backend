import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TeamDocument = Team & Document;

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  leader: string; // wallet address

  @Prop({ type: [String], default: [] })
  members: string[]; // wallet addresses

  @Prop({ type: [String], default: [] })
  pendingInvites: string[]; // wallet addresses

  @Prop()
  eventId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  logo?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  disbanded AtFrom?: Date;

  @Prop({ type: Object })
  stats?: {
    totalSubmissions: number;
    totalWins: number;
    totalParticipations: number;
    averageScore: number;
  };
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Indexes
TeamSchema.index({ leader: 1 });
TeamSchema.index({ members: 1 });
TeamSchema.index({ eventId: 1 });
TeamSchema.index({ isActive: 1 });
TeamSchema.index({ name: 'text', description: 'text' });

