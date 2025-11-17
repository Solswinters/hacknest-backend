import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignatureService } from './signature.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private signatureService: SignatureService,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async issueNonce(address: string) {
    return this.signatureService.issueNonce(address);
  }

  async login(loginDto: LoginDto) {
    const { address, signature, nonce } = loginDto;
    const normalizedAddress = address.toLowerCase();

    // Validate nonce exists and not expired
    const isValidNonce = await this.signatureService.validateNonce(
      normalizedAddress,
      nonce,
    );

    if (!isValidNonce) {
      this.logger.warn(`Invalid or expired nonce for address ${normalizedAddress}`);
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

    const token = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${normalizedAddress}`);

    return {
      token,
      user: {
        address: user.address,
        role: user.role,
        username: user.username,
      },
    };
  }
}

