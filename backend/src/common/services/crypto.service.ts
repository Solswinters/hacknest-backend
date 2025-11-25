import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag?: string; // For GCM mode
}

export interface HashingOptions {
  algorithm?: 'sha256' | 'sha512' | 'md5';
  encoding?: 'hex' | 'base64';
}

export interface PasswordHashingOptions {
  saltRounds?: number;
}

export interface TokenOptions {
  length?: number;
  encoding?: BufferEncoding;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly encryptionKey: Buffer;
  private readonly algorithm: string = 'aes-256-gcm';
  private readonly defaultSaltRounds: number = 12;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!secretKey) {
      this.logger.warn('ENCRYPTION_KEY not set. Using a default key. NOT SECURE FOR PRODUCTION!');
      this.encryptionKey = crypto.scryptSync('default-key-change-me', 'salt', 32);
    } else {
      // Derive a 32-byte key from the provided secret
      this.encryptionKey = crypto.scryptSync(secretKey, 'hacknest-salt', 32);
    }

    this.logger.log('CryptoService initialized.');
  }

  /**
   * Encrypt a string using AES-256-GCM.
   * @param plainText The plain text to encrypt.
   * @returns An object containing the encrypted text, IV, and authentication tag.
   */
  public encrypt(plainText: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(16); // 16 bytes for AES
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt a string using AES-256-GCM.
   * @param encryptionResult The encryption result object containing encrypted text, IV, and tag.
   * @returns The decrypted plain text.
   */
  public decrypt(encryptionResult: EncryptionResult): string {
    try {
      const iv = Buffer.from(encryptionResult.iv, 'hex');
      const authTag = encryptionResult.tag ? Buffer.from(encryptionResult.tag, 'hex') : Buffer.alloc(0);

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      if (authTag.length > 0) {
        decipher.setAuthTag(authTag);
      }

      let decrypted = decipher.update(encryptionResult.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Decryption failed. Invalid key or corrupted data.');
    }
  }

  /**
   * Hash a string using a specified algorithm.
   * @param data The data to hash.
   * @param options Hashing options (algorithm, encoding).
   * @returns The hashed string.
   */
  public hash(data: string, options: HashingOptions = {}): string {
    const algorithm = options.algorithm || 'sha256';
    const encoding = options.encoding || 'hex';

    try {
      const hash = crypto.createHash(algorithm);
      hash.update(data);
      return hash.digest(encoding);
    } catch (error) {
      this.logger.error('Hashing failed:', error);
      throw new Error('Hashing failed');
    }
  }

  /**
   * Hash a password using bcrypt.
   * @param password The password to hash.
   * @param options Hashing options (saltRounds).
   * @returns A promise that resolves with the hashed password.
   */
  public async hashPassword(password: string, options: PasswordHashingOptions = {}): Promise<string> {
    const saltRounds = options.saltRounds || this.defaultSaltRounds;

    try {
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      this.logger.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare a plain text password with a hashed password.
   * @param password The plain text password.
   * @param hashedPassword The hashed password.
   * @returns A promise that resolves with a boolean indicating if they match.
   */
  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      this.logger.error('Password comparison failed:', error);
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Generate a cryptographically secure random token.
   * @param options Token generation options (length, encoding).
   * @returns The generated token as a string.
   */
  public generateToken(options: TokenOptions = {}): string {
    const length = options.length || 32; // 32 bytes = 256 bits
    const encoding = options.encoding || 'hex';

    try {
      return crypto.randomBytes(length).toString(encoding);
    } catch (error) {
      this.logger.error('Token generation failed:', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate a UUID (v4).
   * @returns A UUID string.
   */
  public generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Create an HMAC (Hash-based Message Authentication Code).
   * @param data The data to sign.
   * @param secret The secret key for signing.
   * @param algorithm The hashing algorithm (default: sha256).
   * @returns The HMAC signature as a hex string.
   */
  public createHMAC(data: string, secret: string, algorithm: string = 'sha256'): string {
    try {
      const hmac = crypto.createHmac(algorithm, secret);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      this.logger.error('HMAC creation failed:', error);
      throw new Error('HMAC creation failed');
    }
  }

  /**
   * Verify an HMAC signature.
   * @param data The original data.
   * @param signature The HMAC signature to verify.
   * @param secret The secret key used for signing.
   * @param algorithm The hashing algorithm (default: sha256).
   * @returns True if the signature is valid, false otherwise.
   */
  public verifyHMAC(data: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
    try {
      const expectedSignature = this.createHMAC(data, secret, algorithm);
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (error) {
      this.logger.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Generate a secure random number within a range.
   * @param min Minimum value (inclusive).
   * @param max Maximum value (inclusive).
   * @returns A random number within the specified range.
   */
  public randomInt(min: number, max: number): number {
    if (min >= max) {
      throw new Error('Invalid range: min must be less than max');
    }

    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValue = Math.pow(256, bytesNeeded);
    const threshold = maxValue - (maxValue % range);

    let randomValue: number;
    do {
      const randomBytes = crypto.randomBytes(bytesNeeded);
      randomValue = randomBytes.readUIntBE(0, bytesNeeded);
    } while (randomValue >= threshold);

    return min + (randomValue % range);
  }

  /**
   * Generate a cryptographically secure random string (alphanumeric).
   * @param length The length of the string to generate.
   * @returns A random alphanumeric string.
   */
  public randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = this.randomInt(0, chars.length - 1);
      result += chars[randomIndex];
    }

    return result;
  }

  /**
   * Derive a key from a password using PBKDF2.
   * @param password The password to derive a key from.
   * @param salt The salt (should be random and stored).
   * @param iterations Number of iterations (higher is more secure but slower).
   * @param keyLength Length of the derived key in bytes.
   * @param digest The digest algorithm (default: sha512).
   * @returns A promise that resolves with the derived key as a Buffer.
   */
  public async deriveKey(
    password: string,
    salt: Buffer,
    iterations: number = 100000,
    keyLength: number = 64,
    digest: string = 'sha512',
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keyLength, digest, (err, derivedKey) => {
        if (err) {
          this.logger.error('Key derivation failed:', err);
          reject(new Error('Key derivation failed'));
        } else {
          resolve(derivedKey);
        }
      });
    });
  }

  /**
   * Encrypt an object (serialized to JSON) and return the result.
   * @param obj The object to encrypt.
   * @returns The encryption result.
   */
  public encryptObject(obj: any): EncryptionResult {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt an encrypted object (deserialize from JSON).
   * @param encryptionResult The encryption result.
   * @returns The decrypted object.
   */
  public decryptObject<T = any>(encryptionResult: EncryptionResult): T {
    const json = this.decrypt(encryptionResult);
    return JSON.parse(json) as T;
  }

  /**
   * Create a SHA-256 hash of a file (from a Buffer).
   * @param fileBuffer The file data as a Buffer.
   * @returns The SHA-256 hash as a hex string.
   */
  public hashFile(fileBuffer: Buffer): string {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Generate a checksum for data integrity verification.
   * @param data The data to checksum.
   * @returns The checksum as a hex string.
   */
  public checksum(data: string | Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   * @param a First string.
   * @param b Second string.
   * @returns True if strings are equal, false otherwise.
   */
  public timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch (error) {
      this.logger.error('Timing-safe comparison failed:', error);
      return false;
    }
  }

  /**
   * Encrypt data using RSA public key.
   * @param data The data to encrypt.
   * @param publicKey The RSA public key (PEM format).
   * @returns The encrypted data as a base64 string.
   */
  public encryptWithPublicKey(data: string, publicKey: string): string {
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(data, 'utf8'),
      );
      return encrypted.toString('base64');
    } catch (error) {
      this.logger.error('RSA encryption failed:', error);
      throw new Error('RSA encryption failed');
    }
  }

  /**
   * Decrypt data using RSA private key.
   * @param encryptedData The encrypted data as a base64 string.
   * @param privateKey The RSA private key (PEM format).
   * @returns The decrypted data as a string.
   */
  public decryptWithPrivateKey(encryptedData: string, privateKey: string): string {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64'),
      );
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('RSA decryption failed:', error);
      throw new Error('RSA decryption failed');
    }
  }

  /**
   * Sign data using RSA private key.
   * @param data The data to sign.
   * @param privateKey The RSA private key (PEM format).
   * @returns The signature as a base64 string.
   */
  public signWithPrivateKey(data: string, privateKey: string): string {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      this.logger.error('RSA signing failed:', error);
      throw new Error('RSA signing failed');
    }
  }

  /**
   * Verify a signature using RSA public key.
   * @param data The original data.
   * @param signature The signature to verify (base64).
   * @param publicKey The RSA public key (PEM format).
   * @returns True if the signature is valid, false otherwise.
   */
  public verifyWithPublicKey(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      this.logger.error('RSA signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate an RSA key pair.
   * @param modulusLength The modulus length in bits (default: 2048).
   * @returns An object containing the public and private keys in PEM format.
   */
  public generateKeyPair(modulusLength: number = 2048): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }
}
