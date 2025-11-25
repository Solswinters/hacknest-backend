import {

  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { WalletConnectService } from './walletconnect.service';
import {
  SessionStatsResponseDto,
  DisconnectSessionDto,
  VerifySessionDto,
} from './dto/walletconnect-session.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly walletConnectService: WalletConnectService,
  ) {}

  @Get('nonce')
  @ApiOperation({ summary: 'Request a nonce for wallet authentication' })
  @ApiQuery({ name: 'address', required: true, example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @ApiResponse({ status: 200, description: 'Nonce issued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid address' })
  async getNonce(@Query('address') address: string) {
    if (!address) {
      throw new BadRequestException('Address is required');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Invalid Ethereum address format');
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

  // ==================== WalletConnect Session Management ====================

  @Get('walletconnect/status')
  @ApiOperation({ summary: 'Check WalletConnect service status' })
  @ApiResponse({ status: 200, description: 'WalletConnect status returned' })
  async getWalletConnectStatus() {
    return {
      enabled: this.walletConnectService.isEnabled(),
      message: this.walletConnectService.isEnabled()
        ? 'WalletConnect session management is active'
        : 'WalletConnect not configured. Set WALLETCONNECT_PROJECT_ID to enable.',
    };
  }

  @Get('walletconnect/sessions')
  @ApiOperation({ summary: 'Get all active WalletConnect sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions returned' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async getAllSessions() {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const sessions = this.walletConnectService.getActiveSessions();

    return {
      count: sessions.length,
      sessions: sessions.map((session) => ({
        topic: session.topic,
        expiry: session.expiry,
        acknowledged: session.acknowledged,
        walletName: session.peer.metadata.name,
        walletIcon: session.peer.metadata.icons[0],
        addresses: this.walletConnectService.getAddressesFromSession(session),
        namespaces: Object.keys(session.namespaces),
      })),
    };
  }

  @Get('walletconnect/sessions/:topic')
  @ApiOperation({ summary: 'Get a specific WalletConnect session by topic' })
  @ApiResponse({ status: 200, description: 'Session details returned' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async getSession(@Param('topic') topic: string) {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const session = await this.walletConnectService.getSession(topic);

    if (!session) {
      throw new NotFoundException(`Session with topic ${topic} not found`);
    }

    return {
      topic: session.topic,
      expiry: session.expiry,
      acknowledged: session.acknowledged,
      walletName: session.peer.metadata.name,
      walletDescription: session.peer.metadata.description,
      walletUrl: session.peer.metadata.url,
      walletIcon: session.peer.metadata.icons[0],
      addresses: this.walletConnectService.getAddressesFromSession(session),
      namespaces: session.namespaces,
      controller: session.controller,
    };
  }

  @Get('walletconnect/sessions/address/:address')
  @ApiOperation({ summary: 'Get all sessions for a specific wallet address' })
  @ApiResponse({ status: 200, description: 'Sessions for address returned' })
  @ApiResponse({ status: 400, description: 'Invalid address format' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async getSessionsByAddress(@Param('address') address: string) {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new BadRequestException('Invalid Ethereum address');
    }

    const sessions = this.walletConnectService.getSessionsByAddress(address);

    return {
      address: address.toLowerCase(),
      count: sessions.length,
      sessions: sessions.map((session) => ({
        topic: session.topic,
        expiry: session.expiry,
        acknowledged: session.acknowledged,
        walletName: session.peer.metadata.name,
        walletIcon: session.peer.metadata.icons[0],
      })),
    };
  }

  @Delete('walletconnect/sessions/:topic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect a WalletConnect session' })
  @ApiResponse({ status: 200, description: 'Session disconnected successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async disconnectSession(@Param('topic') topic: string) {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const success = await this.walletConnectService.disconnectSession(topic);

    if (!success) {
      throw new NotFoundException(`Failed to disconnect session ${topic}`);
    }

    return {
      success: true,
      message: 'Session disconnected successfully',
      topic,
    };
  }

  @Post('walletconnect/sessions/:topic/ping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ping a WalletConnect session to check if alive' })
  @ApiResponse({ status: 200, description: 'Session is alive' })
  @ApiResponse({ status: 404, description: 'Session not responding' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async pingSession(@Param('topic') topic: string) {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const isAlive = await this.walletConnectService.pingSession(topic);

    if (!isAlive) {
      throw new NotFoundException(`Session ${topic} is not responding`);
    }

    return {
      success: true,
      message: 'Session is alive',
      topic,
    };
  }

  @Post('walletconnect/sessions/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify if a session contains a specific address' })
  @ApiResponse({ status: 200, description: 'Verification result returned' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async verifySession(@Body() verifyDto: VerifySessionDto) {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const isValid = await this.walletConnectService.verifySessionForAddress(
      verifyDto.topic,
      verifyDto.address,
    );

    return {
      valid: isValid,
      topic: verifyDto.topic,
      address: verifyDto.address.toLowerCase(),
    };
  }

  @Get('walletconnect/stats')
  @ApiOperation({ summary: 'Get WalletConnect session statistics' })
  @ApiResponse({ status: 200, description: 'Statistics returned', type: SessionStatsResponseDto })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async getSessionStats() {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    return this.walletConnectService.getSessionStats();
  }

  @Post('walletconnect/sessions/cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up expired WalletConnect sessions' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  @ApiResponse({ status: 503, description: 'WalletConnect not enabled' })
  async cleanupExpiredSessions() {
    if (!this.walletConnectService.isEnabled()) {
      throw new BadRequestException('WalletConnect session management not enabled');
    }

    const cleaned = await this.walletConnectService.cleanupExpiredSessions();

    return {
      success: true,
      message: `Cleaned up ${cleaned} expired session(s)`,
      count: cleaned,
    };
  }
}

