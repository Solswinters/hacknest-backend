import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  PARTICIPANT = 'participant',
  HOST = 'host',
  JUDGE = 'judge',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true })
  address: string;

  @Prop()
  username?: string;

  @Prop()
  email?: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.PARTICIPANT,
  })
  role: UserRole;

  @Prop({ type: Object })
  profile?: {
    discord?: string;
    twitter?: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for faster queries
UserSchema.index({ address: 1 });

