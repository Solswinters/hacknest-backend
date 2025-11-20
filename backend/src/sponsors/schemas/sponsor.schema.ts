import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SponsorDocument = Sponsor & Document;

export enum SponsorTier {
  PLATINUM = 'platinum',
  GOLD = 'gold',
  SILVER = 'silver',
  BRONZE = 'bronze',
  COMMUNITY = 'community',
}

@Schema({ timestamps: true })
export class Sponsor {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ type: String, enum: SponsorTier, default: SponsorTier.COMMUNITY })
  tier: SponsorTier;

  @Prop()
  logo?: string;

  @Prop()
  website?: string;

  @Prop()
  twitter?: string;

  @Prop()
  discord?: string;

  @Prop({ type: [String], default: [] })
  sponsoredEvents: string[]; // event IDs

  @Prop({ type: Object })
  contribution?: {
    amount: string;
    currency: string;
    transactionHash?: string;
  };

  @Prop({ type: [String], default: [] })
  benefits: string[];

  @Prop({ type: Object })
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);

// Indexes
SponsorSchema.index({ walletAddress: 1 }, { unique: true });
SponsorSchema.index({ tier: 1 });
SponsorSchema.index({ isActive: 1 });
SponsorSchema.index({ name: 'text', description: 'text' });

