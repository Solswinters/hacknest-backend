import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletConfigDocument = WalletConfig & Document;

/**
 * Stores encrypted wallet configuration
 * The private key is NEVER stored in plain text
 */
@Schema({ timestamps: true })
export class WalletConfig {
  @Prop({ required: true, unique: true })
  name: string; // e.g., 'escrow-wallet'

  @Prop({ required: true })
  address: string; // Public wallet address

  @Prop({ required: true })
  encryptedPrivateKey: string; // AES-256-GCM encrypted

  @Prop({ required: true })
  iv: string; // Initialization vector for encryption

  @Prop({ required: true })
  salt: string; // Salt for key derivation

  @Prop({ required: true })
  authTag: string; // Authentication tag for GCM

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastUsed?: Date;
}

export const WalletConfigSchema = SchemaFactory.createForClass(WalletConfig);

WalletConfigSchema.index({ name: 1 }, { unique: true });
WalletConfigSchema.index({ address: 1 });

