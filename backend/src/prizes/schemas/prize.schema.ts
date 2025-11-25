import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type PrizeDocument = Prize & Document;

export enum PrizeStatus {
  AVAILABLE = 'available',
  AWARDED = 'awarded',
  PAYOUT_PENDING = 'payout_pending',
  PAYOUT_INITIATED = 'payout_initiated',
  PAID = 'paid',
  PAYOUT_FAILED = 'payout_failed',
}

export enum PrizeTokenType {
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
  DAI = 'DAI',
  CUSTOM = 'CUSTOM',
}

@Schema({ collection: 'prizes' })
export class Prize {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Event' })
  eventId: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, enum: PrizeTokenType })
  tokenType: PrizeTokenType;

  @Prop()
  tokenAddress?: string;

  @Prop({ type: Number })
  rank?: number;

  @Prop({ type: Types.ObjectId, ref: 'Sponsor' })
  sponsorId?: string;

  @Prop({ required: true, enum: PrizeStatus, default: PrizeStatus.AVAILABLE })
  status: PrizeStatus;

  @Prop({ type: Types.ObjectId, ref: 'Submission' })
  awardedToSubmissionId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  winnerId?: string;

  @Prop()
  payoutWalletAddress?: string;

  @Prop()
  payoutTransactionHash?: string;

  @Prop({ type: Date })
  payoutInitiatedAt?: Date;

  @Prop({ type: Date })
  payoutCompletedAt?: Date;

  @Prop()
  payoutError?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const PrizeSchema = SchemaFactory.createForClass(Prize);

// Indexes
PrizeSchema.index({ eventId: 1 });
PrizeSchema.index({ status: 1 });
PrizeSchema.index({ winnerId: 1 });
PrizeSchema.index({ sponsorId: 1 });
PrizeSchema.index({ rank: 1 });
PrizeSchema.index({ createdAt: -1 });
PrizeSchema.index({ eventId: 1, rank: 1 });
