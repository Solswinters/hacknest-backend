import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignatureService } from './signature.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface LoginResponse {
  token: string;
  user: {
    address: string;
    role: string;
    username?: string;
  };
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private signatureService: SignatureService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async issueNonce(address: string) {
    return this.signatureService.issueNonce(address);
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const startTime = Date.now();
    const { address, signature, nonce } = loginDto;
    const normalizedAddress = address.toLowerCase();

    try {
      // Validate nonce exists and not expired
      const isValidNonce = await this.signatureService.validateNonce(
        normalizedAddress,
        nonce,
      );

      if (!isValidNonce) {
        this.logger.warn(
          `Invalid or expired nonce for address ${normalizedAddress}`,
        );
        throw new UnauthorizedException('Invalid or expired nonce');
      }

      // Construct expected message
      const message = this.signatureService.constructMessage(nonce);

      // Verify signature
      const isValidSignature = this.signatureService.verifySignature(
        message,
        signature,
        normalizedAddress,
      );

      if (!isValidSignature) {
        this.logger.warn(`Invalid signature for address ${normalizedAddress}`);
        throw new UnauthorizedException('Invalid signature');
      }

      // Consume nonce (one-time use)
      await this.signatureService.consumeNonce(normalizedAddress);

      // Upsert user (create if doesn't exist)
      const user = await this.usersService.upsertByAddress(normalizedAddress);

      // Generate JWT
      const payload: JwtPayload = {
        sub: user.address,
        role: user.role,
      };

      const token = this.jwtService.sign(payload, {
        expiresIn: this.TOKEN_EXPIRY_SECONDS,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `User logged in successfully: ${normalizedAddress} (${duration}ms)`,
      );

      return {
        token,
        user: {
          address: user.address,
          role: user.role,
          username: user.username,
        },
        expiresIn: this.TOKEN_EXPIRY_SECONDS,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Login failed for address ${normalizedAddress} (${duration}ms): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null;
    }
  }

  async refreshToken(address: string): Promise<LoginResponse> {
    const normalizedAddress = address.toLowerCase();
    const user = await this.usersService.findByAddress(normalizedAddress);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.address,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: this.TOKEN_EXPIRY_SECONDS,
    });

    this.logger.log(`Token refreshed for user: ${normalizedAddress}`);

    return {
      token,
      user: {
        address: user.address,
        role: user.role,
        username: user.username,
      },
      expiresIn: this.TOKEN_EXPIRY_SECONDS,
    };
  }
}

