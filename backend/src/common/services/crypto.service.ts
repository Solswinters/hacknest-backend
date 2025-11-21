import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;
  private readonly iterations = 100000;
  private readonly keyLength = 32;

  /**
   * Hash password with salt
   */
  async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(this.saltLength);

      crypto.pbkdf2(
        password,
        salt,
        this.iterations,
        this.keyLength,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);

          const hash = Buffer.concat([salt, derivedKey]).toString('hex');
          resolve(hash);
        }
      );
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const hashBuffer = Buffer.from(hash, 'hex');
      const salt = hashBuffer.slice(0, this.saltLength);
      const originalKey = hashBuffer.slice(this.saltLength);

      crypto.pbkdf2(
        password,
        salt,
        this.iterations,
        this.keyLength,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);

          resolve(crypto.timingSafeEqual(originalKey, derivedKey));
        }
      );
    });
  }

  /**
   * Encrypt data
   */
  encrypt(data: string, secret: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);

    const key = crypto.pbkdf2Sync(
      secret,
      salt,
      this.iterations,
      this.keyLength,
      'sha512'
    );

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData: string, secret: string): string {
    const buffer = Buffer.from(encryptedData, 'hex');

    const salt = buffer.slice(0, this.saltLength);
    const iv = buffer.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = buffer.slice(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.tagLength
    );
    const encrypted = buffer.slice(
      this.saltLength + this.ivLength + this.tagLength
    );

    const key = crypto.pbkdf2Sync(
      secret,
      salt,
      this.iterations,
      this.keyLength,
      'sha512'
    );

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }

  /**
   * Generate random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate random bytes
   */
  generateRandomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * Hash data with SHA256
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash data with SHA512
   */
  hashSHA512(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  /**
   * Create HMAC signature
   */
  createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data: string, secret: string, signature: string): boolean {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate secure random number
   */
  generateSecureRandomNumber(min: number, max: number): number {
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const randomBytes = crypto.randomBytes(bytesNeeded);
    const randomNumber = randomBytes.readUIntBE(0, bytesNeeded);
    return min + (randomNumber % range);
  }

  /**
   * Encrypt object
   */
  encryptObject(obj: any, secret: string): string {
    return this.encrypt(JSON.stringify(obj), secret);
  }

  /**
   * Decrypt object
   */
  decryptObject<T>(encryptedData: string, secret: string): T {
    const decrypted = this.decrypt(encryptedData, secret);
    return JSON.parse(decrypted);
  }

  /**
   * Generate API key
   */
  generateApiKey(): string {
    const prefix = 'hn'; // hacknest prefix
    const key = this.generateToken(32);
    return `${prefix}_${key}`;
  }

  /**
   * Hash API key
   */
  hashApiKey(apiKey: string): string {
    return this.hash(apiKey);
  }
}

export default CryptoService;

