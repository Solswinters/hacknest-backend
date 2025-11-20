import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrizeDocument = Prize & Document;

export enum PrizeType {
  MAIN = 'main',
  BONUS = 'bonus',
  SPONSOR = 'sponsor',
  SPECIAL = 'special',
}

export enum PrizeStatus {
  PENDING = 'pending',
  AWARDED = 'awarded',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class Prize {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: String, enum: PrizeType, default: PrizeType.MAIN })
  type: PrizeType;

  @Prop({ required: true })
  amount: string;

  @Prop({ required: true, default: 'ETH' })
  currency: string;

  @Prop()
  rank?: number; // 1st, 2nd, 3rd, etc.

  @Prop({ type: String, enum: PrizeStatus, default: PrizeStatus.PENDING })
  status: PrizeStatus;

  @Prop()
  sponsorId?: string;

  @Prop()
  winnerId?: string; // submission ID or wallet address

  @Prop()
  awardedAt?: Date;

  @Prop()
  claimedAt?: Date;

  @Prop()
  transactionHash?: string;

  @Prop({ type: [String], default: [] })
  criteria: string[];

  @Prop({ type: Object })
  additionalRewards?: {
    description: string;
    value?: string;
  }[];

  @Prop()
  expiryDate?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const PrizeSchema = SchemaFactory.createForClass(Prize);

// Indexes
PrizeSchema.index({ eventId: 1 });
PrizeSchema.index({ type: 1 });
PrizeSchema.index({ status: 1 });
PrizeSchema.index({ winnerId: 1 });
PrizeSchema.index({ sponsorId: 1 });
PrizeSchema.index({ rank: 1 });

