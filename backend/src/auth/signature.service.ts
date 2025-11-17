import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { Nonce, NonceDocument } from './schemas/nonce.schema';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private readonly NONCE_TTL_MINUTES = 10;

  constructor(
    @InjectModel(Nonce.name) private nonceModel: Model<NonceDocument>,
  ) {}

  /**
   * Generate and store a nonce for a wallet address
   */
  async issueNonce(address: string): Promise<{ nonce: string; expiresAt: Date }> {
    const normalizedAddress = address.toLowerCase();
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + this.NONCE_TTL_MINUTES * 60 * 1000);

    // Upsert nonce (replace existing if any)
    await this.nonceModel.findOneAndUpdate(
      { address: normalizedAddress },
      { nonce, expiresAt },
      { upsert: true, new: true },
    );

    this.logger.log(`Issued nonce for address ${normalizedAddress}`);
    return { nonce, expiresAt };
  }

  /**
   * Validate that a nonce exists and is not expired
   */
  async validateNonce(address: string, nonce: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();
    const nonceDoc = await this.nonceModel.findOne({
      address: normalizedAddress,
      nonce,
    });

    if (!nonceDoc) {
      return false;
    }

    // Check if expired
    if (nonceDoc.expiresAt < new Date()) {
      await this.nonceModel.deleteOne({ address: normalizedAddress });
      return false;
    }

    return true;
  }

  /**
   * Verify signature using ethers.js
   * EIP-191 personal_sign format
   */
  verifySignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      const isValid =
        recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();

      if (isValid) {
        this.logger.log(`Signature verified for address ${expectedAddress}`);
      } else {
        this.logger.warn(
          `Signature verification failed. Expected: ${expectedAddress}, Got: ${recoveredAddress}`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Construct the message that should be signed
   */
  constructMessage(nonce: string): string {
    return `I am signing into Hacknest. Nonce: ${nonce}`;
  }

  /**
   * Delete nonce after successful login
   */
  async consumeNonce(address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    await this.nonceModel.deleteOne({ address: normalizedAddress });
    this.logger.log(`Consumed nonce for address ${normalizedAddress}`);
  }
}

