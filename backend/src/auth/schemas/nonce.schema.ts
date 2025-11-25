import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

export type NonceDocument = Nonce & Document;

@Schema()
export class Nonce {
  @Prop({ required: true, unique: true, index: true, lowercase: true })
  address: string;

  @Prop({ required: true })
  nonce: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export const NonceSchema = SchemaFactory.createForClass(Nonce);

// TTL index to automatically delete expired nonces
NonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

