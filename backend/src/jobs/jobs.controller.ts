import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PayoutService } from './payout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { EventsService } from '../events/events.service';

@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly eventsService: EventsService,
  ) {}

  @Post('events/:eventId/payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger payout for an event (Host only)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Payout job enqueued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Host role required' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async triggerPayout(
    @Param('eventId') eventId: string,
    @CurrentUser('address') userAddress: string,
    @Body() body: { winners?: Array<{ address: string; amount: string }> },
  ) {
    // Verify user is the host
    const isHost = await this.eventsService.isHost(eventId, userAddress);
    if (!isHost) {
      throw new Error('Only event host can trigger payout');
    }

    // If winners not provided, get from submissions (must be marked as winners)
    let winners = body.winners;
    
    if (!winners || winners.length === 0) {
      throw new Error('No winners provided');
    }

    const job = await this.payoutService.enqueuePayout(
      eventId,
      winners,
      userAddress,
    );

    return {
      success: true,
      jobId: job._id,
      status: job.status,
    };
  }

  @Post('jobs/process-payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Process pending payout jobs (Admin/Host)',
    description: 'Manually trigger processing of pending payout jobs',
  })
  @ApiResponse({ status: 200, description: 'Payout jobs processed' })
  async processPendingPayouts() {
    await this.payoutService.processPendingPayouts();
    return {
      success: true,
      message: 'Pending payout jobs processed',
    };
  }

  @Get('jobs/:jobId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get job status' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job status returned' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.payoutService.getJobStatus(jobId);

    return {
      id: job._id,
      type: job.type,
      status: job.status,
      payload: job.payload,
      result: job.result,
      createdAt: (job as any).createdAt,
      updatedAt: (job as any).updatedAt,
    };
  }
}

