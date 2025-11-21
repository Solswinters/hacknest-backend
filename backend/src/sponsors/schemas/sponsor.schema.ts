import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SponsorDocument = Sponsor & Document;

@Schema({ collection: 'sponsors' })
export class Sponsor {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  websiteUrl?: string;

  @Prop({ required: true })
  contactEmail: string;

  @Prop()
  contactPhone?: string;

  @Prop()
  contactName?: string;

  @Prop()
  tier?: string;

  @Prop({ type: Number, default: 0 })
  amount?: number;

  @Prop({ type: [String], default: [] })
  eventIds: string[];

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);

// Indexes
SponsorSchema.index({ name: 1 });
SponsorSchema.index({ contactEmail: 1 });
SponsorSchema.index({ eventIds: 1 });
SponsorSchema.index({ tier: 1 });
SponsorSchema.index({ createdAt: -1 });
