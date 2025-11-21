import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.getHealthStatus();
  }

  @Get('detailed')
  detailedCheck() {
    return this.healthService.getDetailedHealth();
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  async readiness() {
    const isReady = await this.healthService.isReady();
    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
    };
  }
}

export default HealthController;

