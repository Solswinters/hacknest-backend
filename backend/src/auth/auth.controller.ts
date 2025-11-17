import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('nonce')
  @ApiOperation({ summary: 'Request a nonce for wallet authentication' })
  @ApiQuery({ name: 'address', required: true, example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @ApiResponse({ status: 200, description: 'Nonce issued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid address' })
  async getNonce(@Query('address') address: string) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Invalid Ethereum address');
    }

    const { nonce, expiresAt } = await this.authService.issueNonce(address);

    return {
      nonce,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with signed nonce' })
  @ApiResponse({ status: 200, description: 'Login successful, JWT returned' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Invalid signature or nonce' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    if (!result) {
      throw new UnauthorizedException('Invalid signature or nonce');
    }

    return result;
  }
}

