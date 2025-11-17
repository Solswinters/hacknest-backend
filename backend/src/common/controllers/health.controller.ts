import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    const dbStatus =
      this.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check Web3 provider (basic check)
    const providerUrl = this.configService.get<string>('web3.providerUrl');
    const providerStatus = providerUrl ? 'configured' : 'not configured';

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
      },
      web3Provider: {
        status: providerStatus,
        url: providerUrl,
      },
    };
  }
}

