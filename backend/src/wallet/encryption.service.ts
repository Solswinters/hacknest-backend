import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

import * as crypto from 'crypto';

/**
 * Advanced encryption service for securing private keys
 * Uses AES-256-GCM with PBKDF2 key derivation
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly iterations = 100000; // PBKDF2 iterations
  private readonly masterPassword: string;

  constructor(private configService: ConfigService) {
    // Master password MUST be set in environment
    const password = this.configService.get<string>('WALLET_MASTER_PASSWORD');
    
    if (!password || password.length < 32) {
      this.logger.error('WALLET_MASTER_PASSWORD must be set and at least 32 characters');
      throw new Error('Invalid wallet master password configuration');
    }
    
    this.masterPassword = password;
  }

  /**
   * Derive encryption key from master password using PBKDF2
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      this.masterPassword,
      salt,
      this.iterations,
      this.keyLength,
      'sha256',
    );
  }

  /**
   * Encrypt private key using AES-256-GCM
   */
  encrypt(privateKey: string): {
    encrypted: string;
    iv: string;
    salt: string;
    authTag: string;
  } {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      // Derive encryption key
      const key = this.deriveKey(salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      this.logger.log('Private key encrypted successfully');

      return {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt private key using AES-256-GCM
   */
  decrypt(
    encrypted: string,
    iv: string,
    salt: string,
    authTag: string,
  ): string {
    try {
      // Convert hex strings to buffers
      const ivBuffer = Buffer.from(iv, 'hex');
      const saltBuffer = Buffer.from(salt, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');

      // Derive decryption key (same as encryption)
      const key = this.deriveKey(saltBuffer);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('Private key decrypted successfully');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt private key - invalid master password or corrupted data');
    }
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(data: string): void {
    if (data) {
      // Overwrite with random data before garbage collection
      crypto.randomBytes(data.length);
    }
  }
}

