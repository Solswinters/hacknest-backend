import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AnalyticsService } from '../services/analytics.service';
import { TrackEventDto, AnalyticsFilterDto } from '../dto/analytics.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) { }

  /**
   * Track an analytics event
   */
  @Post('track')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async trackEvent(@Body() trackEventDto: TrackEventDto, @Request() req) {
    try {
      this.logger.log(`Tracking event: ${trackEventDto.eventName} for user ${req.user.userId}`);
      const event = await this.analyticsService.trackEvent({
        ...trackEventDto,
        userId: req.user.userId,
      });
      return {
        success: true,
        message: 'Event tracked successfully',
        data: event,
      };
    } catch (error) {
      this.logger.error('Failed to track event:', error);
      throw new BadRequestException(error.message || 'Failed to track event');
    }
  }

  /**
   * Get platform overview statistics
   */
  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform overview statistics' })
  @ApiResponse({ status: 200, description: 'Overview statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPlatformOverview(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching platform overview for last ${days} days`);
      const overview = await this.analyticsService.getPlatformOverview(days);
      return {
        success: true,
        message: 'Overview statistics retrieved successfully',
        data: overview,
      };
    } catch (error) {
      this.logger.error('Failed to fetch platform overview:', error);
      throw new BadRequestException(error.message || 'Failed to fetch overview');
    }
  }

  /**
   * Get user analytics
   */
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user analytics' })
  @ApiResponse({ status: 200, description: 'User analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUserAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching user analytics for last ${days} days`);
      const analytics = await this.analyticsService.getUserAnalytics(days);
      return {
        success: true,
        message: 'User analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get event analytics
   */
  @Get('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event analytics' })
  @ApiResponse({ status: 200, description: 'Event analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEventAnalytics(@Query('eventId') eventId?: string, @Query('days') days = 30) {
    try {
      this.logger.log(`Fetching event analytics${eventId ? ` for event ${eventId}` : ''}`);
      const analytics = await this.analyticsService.getEventAnalytics(eventId, days);
      return {
        success: true,
        message: 'Event analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch event analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get submission analytics
   */
  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get submission analytics' })
  @ApiResponse({ status: 200, description: 'Submission analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSubmissionAnalytics(@Query('eventId') eventId?: string, @Query('days') days = 30) {
    try {
      this.logger.log(`Fetching submission analytics${eventId ? ` for event ${eventId}` : ''}`);
      const analytics = await this.analyticsService.getSubmissionAnalytics(eventId, days);
      return {
        success: true,
        message: 'Submission analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch submission analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get engagement analytics
   */
  @Get('engagement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get engagement analytics' })
  @ApiResponse({ status: 200, description: 'Engagement analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEngagementAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching engagement analytics for last ${days} days`);
      const analytics = await this.analyticsService.getEngagementAnalytics(days);
      return {
        success: true,
        message: 'Engagement analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch engagement analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get retention analytics
   */
  @Get('retention')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get retention analytics' })
  @ApiResponse({ status: 200, description: 'Retention analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRetentionAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching retention analytics for last ${days} days`);
      const analytics = await this.analyticsService.getRetentionAnalytics(days);
      return {
        success: true,
        message: 'Retention analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch retention analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get conversion analytics
   */
  @Get('conversion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get conversion analytics' })
  @ApiResponse({ status: 200, description: 'Conversion analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getConversionAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching conversion analytics for last ${days} days`);
      const analytics = await this.analyticsService.getConversionAnalytics(days);
      return {
        success: true,
        message: 'Conversion analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch conversion analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get revenue analytics
   */
  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRevenueAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching revenue analytics for last ${days} days`);
      const analytics = await this.analyticsService.getRevenueAnalytics(days);
      return {
        success: true,
        message: 'Revenue analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch revenue analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get team analytics
   */
  @Get('teams')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get team analytics' })
  @ApiResponse({ status: 200, description: 'Team analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTeamAnalytics(@Query('eventId') eventId?: string, @Query('days') days = 30) {
    try {
      this.logger.log(`Fetching team analytics${eventId ? ` for event ${eventId}` : ''}`);
      const analytics = await this.analyticsService.getTeamAnalytics(eventId, days);
      return {
        success: true,
        message: 'Team analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch team analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get sponsor analytics
   */
  @Get('sponsors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sponsor analytics' })
  @ApiResponse({ status: 200, description: 'Sponsor analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSponsorAnalytics(@Query('sponsorId') sponsorId?: string, @Query('days') days = 30) {
    try {
      this.logger.log(`Fetching sponsor analytics${sponsorId ? ` for sponsor ${sponsorId}` : ''}`);
      const analytics = await this.analyticsService.getSponsorAnalytics(sponsorId, days);
      return {
        success: true,
        message: 'Sponsor analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch sponsor analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch analytics');
    }
  }

  /**
   * Get time series data
   */
  @Get('timeseries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get time series data' })
  @ApiResponse({ status: 200, description: 'Time series data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTimeSeries(
    @Query('metric') metric: string,
    @Query('granularity') granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
    @Query('days') days = 30,
  ) {
    try {
      this.logger.log(`Fetching time series for ${metric} with ${granularity} granularity`);
      const timeSeries = await this.analyticsService.getTimeSeries(metric, granularity, days);
      return {
        success: true,
        message: 'Time series data retrieved successfully',
        data: timeSeries,
      };
    } catch (error) {
      this.logger.error('Failed to fetch time series:', error);
      throw new BadRequestException(error.message || 'Failed to fetch time series');
    }
  }

  /**
   * Get custom analytics query
   */
  @Post('query')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get custom analytics query' })
  @ApiResponse({ status: 200, description: 'Query results retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async customQuery(@Body() body: { query: any; filters?: any }, @Request() req) {
    try {
      this.logger.log(`Executing custom analytics query by user ${req.user.userId}`);
      const results = await this.analyticsService.customQuery(body.query, body.filters);
      return {
        success: true,
        message: 'Query results retrieved successfully',
        data: results,
      };
    } catch (error) {
      this.logger.error('Failed to execute custom query:', error);
      throw new BadRequestException(error.message || 'Failed to execute query');
    }
  }

  /**
   * Get funnel analytics
   */
  @Get('funnel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get funnel analytics' })
  @ApiResponse({ status: 200, description: 'Funnel analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getFunnelAnalytics(
    @Query('funnelType') funnelType: string,
    @Query('days') days = 30,
  ) {
    try {
      this.logger.log(`Fetching funnel analytics for ${funnelType}`);
      const analytics = await this.analyticsService.getFunnelAnalytics(funnelType, days);
      return {
        success: true,
        message: 'Funnel analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch funnel analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch funnel analytics');
    }
  }

  /**
   * Get cohort analysis
   */
  @Get('cohorts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cohort analysis' })
  @ApiResponse({ status: 200, description: 'Cohort analysis retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCohortAnalysis(
    @Query('cohortType') cohortType: string = 'registration',
    @Query('metric') metric: string = 'retention',
    @Query('weeks') weeks = 12,
  ) {
    try {
      this.logger.log(`Fetching cohort analysis for ${cohortType}`);
      const analytics = await this.analyticsService.getCohortAnalysis(cohortType, metric, weeks);
      return {
        success: true,
        message: 'Cohort analysis retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch cohort analysis:', error);
      throw new BadRequestException(error.message || 'Failed to fetch cohort analysis');
    }
  }

  /**
   * Export analytics data
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Analytics data exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportAnalytics(
    @Query('format') format: 'csv' | 'json' = 'json',
    @Query('type') type: string,
    @Query('days') days = 30,
  ) {
    try {
      this.logger.log(`Exporting ${type} analytics in ${format} format`);
      const data = await this.analyticsService.exportAnalytics(type, format, days);
      return {
        success: true,
        message: 'Analytics data exported successfully',
        data,
      };
    } catch (error) {
      this.logger.error('Failed to export analytics:', error);
      throw new BadRequestException(error.message || 'Failed to export analytics');
    }
  }

  /**
   * Get real-time analytics
   */
  @Get('realtime')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get real-time analytics' })
  @ApiResponse({ status: 200, description: 'Real-time analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRealtimeAnalytics() {
    try {
      this.logger.log('Fetching real-time analytics');
      const analytics = await this.analyticsService.getRealtimeAnalytics();
      return {
        success: true,
        message: 'Real-time analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch real-time analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch real-time analytics');
    }
  }

  /**
   * Get geographic analytics
   */
  @Get('geographic')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get geographic analytics' })
  @ApiResponse({ status: 200, description: 'Geographic analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getGeographicAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching geographic analytics for last ${days} days`);
      const analytics = await this.analyticsService.getGeographicAnalytics(days);
      return {
        success: true,
        message: 'Geographic analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch geographic analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch geographic analytics');
    }
  }

  /**
   * Get device analytics
   */
  @Get('devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get device analytics' })
  @ApiResponse({ status: 200, description: 'Device analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDeviceAnalytics(@Query('days') days = 30) {
    try {
      this.logger.log(`Fetching device analytics for last ${days} days`);
      const analytics = await this.analyticsService.getDeviceAnalytics(days);
      return {
        success: true,
        message: 'Device analytics retrieved successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Failed to fetch device analytics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch device analytics');
    }
  }
}

