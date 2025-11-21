/**
 * Crypto Service - Cryptography utilities for secure operations
 * SECURITY: Provide secure hashing, encryption, and signing functions
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag?: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;

  /**
   * Generate random bytes
   */
  generateRandomBytes(length: number = 32): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Generate random string
   */
  generateRandomString(length: number = 32): string {
    return this.generateRandomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Hash data using SHA-256
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash data using SHA-512
   */
  hashSHA512(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  /**
   * Create HMAC
   */
  createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data: string, secret: string, hmac: string): boolean {
    const expected = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(hmac)
    );
  }

  /**
   * Hash password using bcrypt-like method (PBKDF2)
   */
  async hashPassword(password: string, salt?: string): Promise<string> {
    const actualSalt = salt || this.generateRandomBytes(16).toString('hex');
    const iterations = 100000;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        actualSalt,
        iterations,
        64,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(`${actualSalt}:${iterations}:${derivedKey.toString('hex')}`);
        }
      );
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, iterations, key] = hash.split(':');

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        parseInt(iterations),
        64,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(key === derivedKey.toString('hex'));
        }
      );
    });
  }

  /**
   * Encrypt data
   */
  encrypt(data: string, key: string): EncryptionResult {
    try {
      // Derive key
      const derivedKey = crypto
        .createHash('sha256')
        .update(key)
        .digest();

      // Generate IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

      // Encrypt
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag for GCM
      const authTag = cipher.getAuthTag().toString('hex');

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag,
      };
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  decrypt(
    encrypted: string,
    key: string,
    iv: string,
    authTag?: string
  ): string {
    try {
      // Derive key
      const derivedKey = crypto
        .createHash('sha256')
        .update(key)
        .digest();

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        derivedKey,
        Buffer.from(iv, 'hex')
      );

      // Set auth tag for GCM
      if (authTag) {
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      }

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Sign data
   */
  sign(data: string, privateKey: string): string {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      return sign.sign(privateKey, 'hex');
    } catch (error) {
      this.logger.error('Signing failed', error);
      throw new Error('Signing failed');
    }
  }

  /**
   * Verify signature
   */
  verifySignature(
    data: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  /**
   * Generate RSA key pair
   */
  async generateKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) reject(err);
          resolve({ publicKey, privateKey });
        }
      );
    });
  }

  /**
   * Generate nonce for Web3 authentication
   */
  generateNonce(): string {
    return this.generateRandomString(32);
  }

  /**
   * Verify Ethereum signature
   */
  verifyEthereumSignature(
    message: string,
    signature: string,
    address: string
  ): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return (
        recoveredAddress.toLowerCase() === address.toLowerCase()
      );
    } catch (error) {
      this.logger.error('Ethereum signature verification failed', error);
      return false;
    }
  }

  /**
   * Hash Ethereum message (EIP-191)
   */
  hashEthereumMessage(message: string): string {
    return ethers.hashMessage(message);
  }

  /**
   * Recover address from signature
   */
  recoverAddress(message: string, signature: string): string {
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      this.logger.error('Address recovery failed', error);
      throw new Error('Address recovery failed');
    }
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix: string = 'hk'): string {
    const random = this.generateRandomString(32);
    return `${prefix}_${random}`;
  }

  /**
   * Hash API key for storage
   */
  hashApiKey(apiKey: string): string {
    return this.hash(apiKey);
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey: string, hashedKey: string): boolean {
    return this.hash(apiKey) === hashedKey;
  }

  /**
   * Generate JWT secret
   */
  generateJWTSecret(): string {
    return this.generateRandomBytes(64).toString('base64');
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length: number = 32): string {
    return this.generateRandomBytes(length).toString('base64url');
  }

  /**
   * Constant-time string comparison
   */
  safeCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a),
        Buffer.from(b)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate checksum
   */
  generateChecksum(data: string): string {
    return crypto
      .createHash('md5')
      .update(data)
      .digest('hex');
  }

  /**
   * Verify checksum
   */
  verifyChecksum(data: string, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  /**
   * Base64 encode
   */
  base64Encode(data: string): string {
    return Buffer.from(data).toString('base64');
  }

  /**
   * Base64 decode
   */
  base64Decode(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  /**
   * Base64URL encode (URL-safe)
   */
  base64URLEncode(data: string): string {
    return Buffer.from(data).toString('base64url');
  }

  /**
   * Base64URL decode
   */
  base64URLDecode(encoded: string): string {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  }

  /**
   * Hex encode
   */
  hexEncode(data: string): string {
    return Buffer.from(data).toString('hex');
  }

  /**
   * Hex decode
   */
  hexDecode(encoded: string): string {
    return Buffer.from(encoded, 'hex').toString('utf8');
  }

  /**
   * Generate OTP (One-Time Password)
   */
  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';

    const randomBytes = this.generateRandomBytes(length);

    for (let i = 0; i < length; i++) {
      otp += digits[randomBytes[i] % digits.length];
    }

    return otp;
  }

  /**
   * Generate time-based OTP (TOTP)
   */
  generateTOTP(secret: string, timeStep: number = 30): string {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(time, 4);

    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const code =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Verify TOTP
   */
  verifyTOTP(
    token: string,
    secret: string,
    timeStep: number = 30,
    window: number = 1
  ): boolean {
    const currentTime = Math.floor(Date.now() / 1000 / timeStep);

    for (let i = -window; i <= window; i++) {
      const testTime = currentTime + i;
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeUInt32BE(testTime, 4);

      const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
      hmac.update(timeBuffer);
      const hash = hmac.digest();

      const offset = hash[hash.length - 1] & 0xf;
      const code =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

      const expected = (code % 1000000).toString().padStart(6, '0');

      if (token === expected) {
        return true;
      }
    }

    return false;
  }
}

export default CryptoService;
