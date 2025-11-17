import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

export enum RewardCurrency {
  ETH = 'ETH',
  ERC20 = 'ERC20',
}

export enum EventStatus {
  DRAFT = 'draft',
  LIVE = 'live',
  CLOSED = 'closed',
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, index: true })
  host: string;

  @Prop({ required: true, minlength: 3, maxlength: 128 })
  title: string;

  @Prop({ required: true, maxlength: 5000 })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(RewardCurrency),
    default: RewardCurrency.ETH,
  })
  rewardCurrency: RewardCurrency;

  @Prop({ required: true })
  rewardAmount: string; // wei or smallest token unit as string

  @Prop()
  contractAddress?: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: [String], default: [] })
  judges: string[];

  @Prop({
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.DRAFT,
  })
  status: EventStatus;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Indexes for faster queries
EventSchema.index({ host: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ startDate: 1, endDate: 1 });

