import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubmissionDocument = Submission & Document;

export enum SubmissionStatus {
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WINNER = 'winner',
}

@Schema({ timestamps: true })
export class Submission {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ required: true, index: true })
  participant: string; // wallet address

  @Prop({ required: true, minlength: 3, maxlength: 128 })
  title: string;

  @Prop()
  repo?: string;

  @Prop()
  url?: string;

  @Prop({ required: true })
  signature: string; // signed proof of submission

  @Prop()
  ipfsHash?: string;

  @Prop({
    type: String,
    enum: Object.values(SubmissionStatus),
    default: SubmissionStatus.SUBMITTED,
  })
  status: SubmissionStatus;

  @Prop()
  score?: number;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);

// Indexes for faster queries
SubmissionSchema.index({ eventId: 1, participant: 1 });
SubmissionSchema.index({ eventId: 1, status: 1 });
SubmissionSchema.index({ participant: 1 });

