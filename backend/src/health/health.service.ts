import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  private startTime: Date = new Date();

  getHealthStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
    };
  }

  async getDetailedHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      services: {
        database: await this.checkDatabase(),
        cache: this.checkCache(),
        storage: this.checkStorage(),
      },
      system: {
        memory: this.getMemoryUsage(),
        cpu: process.cpuUsage(),
      },
    };
  }

  async isReady(): Promise<boolean> {
    const dbHealth = await this.checkDatabase();
    return dbHealth.status === 'healthy';
  }

  private async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      // Simulate DB check
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private checkCache(): { status: string } {
    return { status: 'healthy' };
  }

  private checkStorage(): { status: string } {
    return { status: 'healthy' };
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    };
  }
}

export default HealthService;

