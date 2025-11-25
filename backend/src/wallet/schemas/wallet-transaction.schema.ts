import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document, Types } from 'mongoose';

export type WalletTransactionDocument = WalletTransaction & Document;

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  PAYOUT = 'payout',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class WalletTransaction {
  @Prop({ type: String, enum: Object.values(TransactionType), required: true })
  type: TransactionType;

  @Prop({ required: true })
  from: string; // Address

  @Prop({ required: true })
  to: string; // Address

  @Prop({ required: true })
  amount: string; // Wei as string

  @Prop()
  txHash?: string; // Blockchain transaction hash

  @Prop({ type: String, enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ type: Types.ObjectId, ref: 'Event' })
  eventId?: Types.ObjectId;

  @Prop()
  initiatedBy?: string; // User address who initiated

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: {
    gasPrice?: string;
    gasUsed?: string;
    blockNumber?: number;
    confirmations?: number;
  };

  @Prop()
  errorMessage?: string;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);

WalletTransactionSchema.index({ txHash: 1 });
WalletTransactionSchema.index({ from: 1 });
WalletTransactionSchema.index({ to: 1 });
WalletTransactionSchema.index({ eventId: 1 });
WalletTransactionSchema.index({ status: 1, type: 1 });
WalletTransactionSchema.index({ createdAt: -1 });

