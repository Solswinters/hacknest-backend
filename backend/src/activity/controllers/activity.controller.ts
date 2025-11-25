import {

  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActivityService } from '../services/activity.service';
import { CreateActivityDto, ActivityFilterDto } from '../dto/activity.dto';

@ApiTags('Activity')
@Controller('activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);

  constructor(private readonly activityService: ActivityService) {}

  /**
   * Create a new activity log entry
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new activity log entry' })
  @ApiResponse({ status: 201, description: 'Activity log created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createActivity(@Body() createActivityDto: CreateActivityDto, @Request() req) {
    try {
      this.logger.log(`Creating activity log for user ${req.user.userId}: ${createActivityDto.action}`);
      const activity = await this.activityService.createActivity({
        ...createActivityDto,
        userId: req.user.userId,
      });
      return {
        success: true,
        message: 'Activity log created successfully',
        data: activity,
      };
    } catch (error) {
      this.logger.error('Failed to create activity log:', error);
      throw new BadRequestException(error.message || 'Failed to create activity log');
    }
  }

  /**
   * Get all activity logs with optional filtering
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all activity logs' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllActivities(@Query() filterDto: ActivityFilterDto) {
    try {
      this.logger.log('Fetching all activity logs with filters');
      const { activities, total, page, limit } = await this.activityService.getAllActivities(filterDto);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch activity logs:', error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Get activity log by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity log by ID' })
  @ApiResponse({ status: 200, description: 'Activity log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Activity log not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActivityById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching activity log: ${id}`);
      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundException(`Activity log with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Activity log retrieved successfully',
        data: activity,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch activity log ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch activity log');
    }
  }

  /**
   * Get activity logs by user ID
   */
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity logs by user ID' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActivitiesByUserId(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Request() req,
  ) {
    try {
      // Users can only view their own activity unless they're admin/organizer
      if (userId !== req.user.userId && !['admin', 'organizer'].includes(req.user.role)) {
        throw new BadRequestException('You can only view your own activity logs');
      }

      this.logger.log(`Fetching activity logs for user: ${userId}`);
      const { activities, total } = await this.activityService.getActivitiesByUserId(userId, page, limit);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch activity logs for user ${userId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Get current user's activity logs
   */
  @Get('user/me/logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s activity logs' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivities(@Query('page') page = 1, @Query('limit') limit = 20, @Request() req) {
    try {
      this.logger.log(`Fetching activity logs for user: ${req.user.userId}`);
      const { activities, total } = await this.activityService.getActivitiesByUserId(req.user.userId, page, limit);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch user activity logs:', error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Get activity logs by event ID
   */
  @Get('event/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity logs by event ID' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getActivitiesByEventId(
    @Param('eventId') eventId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      this.logger.log(`Fetching activity logs for event: ${eventId}`);
      const { activities, total } = await this.activityService.getActivitiesByEventId(eventId, page, limit);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch activity logs for event ${eventId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Get activity logs by entity (e.g., submission, team)
   */
  @Get('entity/:entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity logs by entity' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActivitiesByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      this.logger.log(`Fetching activity logs for ${entityType}: ${entityId}`);
      const { activities, total } = await this.activityService.getActivitiesByEntity(entityType, entityId, page, limit);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch activity logs for ${entityType} ${entityId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Get activity logs by action type
   */
  @Get('action/:actionType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity logs by action type' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getActivitiesByAction(
    @Param('actionType') actionType: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      this.logger.log(`Fetching activity logs for action: ${actionType}`);
      const { activities, total } = await this.activityService.getActivitiesByAction(actionType, page, limit);
      return {
        success: true,
        message: 'Activity logs retrieved successfully',
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch activity logs for action ${actionType}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch activity logs');
    }
  }

  /**
   * Delete activity log
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete activity log' })
  @ApiResponse({ status: 204, description: 'Activity log deleted successfully' })
  @ApiResponse({ status: 404, description: 'Activity log not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteActivity(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting activity log: ${id} by user ${req.user.userId}`);
      const deleted = await this.activityService.deleteActivity(id);
      if (!deleted) {
        throw new NotFoundException(`Activity log with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Activity log deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete activity log ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete activity log');
    }
  }

  /**
   * Get activity statistics
   */
  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getActivityStats(@Query('eventId') eventId?: string, @Query('days') days = 30) {
    try {
      this.logger.log(`Fetching activity statistics${eventId ? ` for event ${eventId}` : ''}`);
      const stats = await this.activityService.getActivityStatistics(eventId, days);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch activity statistics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Get activity timeline
   */
  @Get('timeline/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity timeline' })
  @ApiResponse({ status: 200, description: 'Activity timeline retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActivityTimeline(
    @Query('userId') userId?: string,
    @Query('eventId') eventId?: string,
    @Query('days') days = 7,
    @Request() req = null,
  ) {
    try {
      // If userId is provided and it's not the current user, check permissions
      if (userId && req && userId !== req.user.userId && !['admin', 'organizer'].includes(req.user.role)) {
        throw new BadRequestException('You can only view your own activity timeline');
      }

      this.logger.log(`Fetching activity timeline${userId ? ` for user ${userId}` : ''}${eventId ? ` for event ${eventId}` : ''}`);
      const timeline = await this.activityService.getActivityTimeline(userId, eventId, days);
      return {
        success: true,
        message: 'Activity timeline retrieved successfully',
        data: timeline,
      };
    } catch (error) {
      this.logger.error('Failed to fetch activity timeline:', error);
      throw new BadRequestException(error.message || 'Failed to fetch activity timeline');
    }
  }

  /**
   * Get recent activity
   */
  @Get('recent/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent activity' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecentActivity(@Query('limit') limit = 10, @Query('eventId') eventId?: string) {
    try {
      this.logger.log(`Fetching recent activity${eventId ? ` for event ${eventId}` : ''}`);
      const activities = await this.activityService.getRecentActivity(limit, eventId);
      return {
        success: true,
        message: 'Recent activity retrieved successfully',
        data: activities,
      };
    } catch (error) {
      this.logger.error('Failed to fetch recent activity:', error);
      throw new BadRequestException(error.message || 'Failed to fetch recent activity');
    }
  }

  /**
   * Bulk delete old activity logs
   */
  @Delete('bulk/cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete old activity logs' })
  @ApiResponse({ status: 200, description: 'Activity logs deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async bulkDeleteOldActivities(@Query('days') days = 90, @Request() req) {
    try {
      this.logger.log(`Bulk deleting activity logs older than ${days} days by user ${req.user.userId}`);
      const count = await this.activityService.deleteOldActivities(days);
      return {
        success: true,
        message: `Deleted ${count} old activity logs`,
        data: { deletedCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to bulk delete old activity logs:', error);
      throw new BadRequestException(error.message || 'Failed to delete activity logs');
    }
  }
}

