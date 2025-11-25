import {

  Controller,
  Get,
  Post,
  Put,
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
import { NotificationsService } from '../services/notifications.service';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationFilterDto,
  MarkAsReadDto,
} from '../dto/notification.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Create a new notification
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createNotification(@Body() createNotificationDto: CreateNotificationDto, @Request() req) {
    try {
      this.logger.log(`Creating notification by user ${req.user.userId}`);
      const notification = await this.notificationsService.createNotification(createNotificationDto, req.user.userId);
      return {
        success: true,
        message: 'Notification created successfully',
        data: notification,
      };
    } catch (error) {
      this.logger.error('Failed to create notification:', error);
      throw new BadRequestException(error.message || 'Failed to create notification');
    }
  }

  /**
   * Get all notifications with optional filtering (admin only)
   */
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications (admin only)' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllNotifications(@Query() filterDto: NotificationFilterDto) {
    try {
      this.logger.log('Fetching all notifications with filters');
      const { notifications, total, page, limit } = await this.notificationsService.getAllNotifications(filterDto);
      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: notifications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch notifications:', error);
      throw new BadRequestException(error.message || 'Failed to fetch notifications');
    }
  }

  /**
   * Get current user's notifications
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyNotifications(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('unreadOnly') unreadOnly = false,
    @Request() req,
  ) {
    try {
      this.logger.log(`Fetching notifications for user: ${req.user.userId}`);
      const { notifications, total } = await this.notificationsService.getUserNotifications(
        req.user.userId,
        page,
        limit,
        unreadOnly,
      );
      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: notifications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch user notifications:', error);
      throw new BadRequestException(error.message || 'Failed to fetch notifications');
    }
  }

  /**
   * Get notification by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationById(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Fetching notification: ${id}`);
      const notification = await this.notificationsService.getNotificationById(id);
      
      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      // Check if user has access to this notification
      if (notification.recipientId !== req.user.userId && !['admin'].includes(req.user.role)) {
        throw new BadRequestException('You do not have access to this notification');
      }

      return {
        success: true,
        message: 'Notification retrieved successfully',
        data: notification,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch notification ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch notification');
    }
  }

  /**
   * Get unread notification count for current user
   */
  @Get('count/unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Count retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Request() req) {
    try {
      this.logger.log(`Fetching unread count for user: ${req.user.userId}`);
      const count = await this.notificationsService.getUnreadCount(req.user.userId);
      return {
        success: true,
        message: 'Unread count retrieved successfully',
        data: { unreadCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to fetch unread count:', error);
      throw new BadRequestException(error.message || 'Failed to fetch unread count');
    }
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' }}
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Marking notification ${id} as read by user ${req.user.userId}`);
      const notification = await this.notificationsService.markAsRead(id, req.user.userId);
      
      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      return {
        success: true,
        message: 'Notification marked as read',
        data: notification,
      };
    } catch (error) {
      this.logger.error(`Failed to mark notification ${id} as read:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to mark notification as read');
    }
  }

  /**
   * Mark notification as unread
   */
  @Put(':id/unread')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as unread' })
  @ApiResponse({ status: 200, description: 'Notification marked as unread' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsUnread(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Marking notification ${id} as unread by user ${req.user.userId}`);
      const notification = await this.notificationsService.markAsUnread(id, req.user.userId);
      
      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      return {
        success: true,
        message: 'Notification marked as unread',
        data: notification,
      };
    } catch (error) {
      this.logger.error(`Failed to mark notification ${id} as unread:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to mark notification as unread');
    }
  }

  /**
   * Mark all notifications as read for current user
   */
  @Put('batch/mark-all-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Request() req) {
    try {
      this.logger.log(`Marking all notifications as read for user ${req.user.userId}`);
      const count = await this.notificationsService.markAllAsRead(req.user.userId);
      return {
        success: true,
        message: `Marked ${count} notifications as read`,
        data: { markedCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to mark all notifications as read:', error);
      throw new BadRequestException(error.message || 'Failed to mark all notifications as read');
    }
  }

  /**
   * Mark multiple notifications as read
   */
  @Put('batch/mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markMultipleAsRead(@Body() markAsReadDto: MarkAsReadDto, @Request() req) {
    try {
      this.logger.log(`Marking ${markAsReadDto.notificationIds.length} notifications as read by user ${req.user.userId}`);
      const count = await this.notificationsService.markMultipleAsRead(markAsReadDto.notificationIds, req.user.userId);
      return {
        success: true,
        message: `Marked ${count} notifications as read`,
        data: { markedCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to mark notifications as read:', error);
      throw new BadRequestException(error.message || 'Failed to mark notifications as read');
    }
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({ status: 204, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteNotification(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting notification: ${id} by user ${req.user.userId}`);
      const deleted = await this.notificationsService.deleteNotification(id, req.user.userId);
      
      if (!deleted) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete notification ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete notification');
    }
  }

  /**
   * Delete all notifications for current user
   */
  @Delete('batch/clear-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all notifications for current user' })
  @ApiResponse({ status: 200, description: 'All notifications deleted' }}
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAllNotifications(@Request() req) {
    try {
      this.logger.log(`Deleting all notifications for user ${req.user.userId}`);
      const count = await this.notificationsService.deleteAllUserNotifications(req.user.userId);
      return {
        success: true,
        message: `Deleted ${count} notifications`,
        data: { deletedCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to delete all notifications:', error);
      throw new BadRequestException(error.message || 'Failed to delete all notifications');
    }
  }

  /**
   * Delete read notifications for current user
   */
  @Delete('batch/clear-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete read notifications for current user' })
  @ApiResponse({ status: 200, description: 'Read notifications deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteReadNotifications(@Request() req) {
    try {
      this.logger.log(`Deleting read notifications for user ${req.user.userId}`);
      const count = await this.notificationsService.deleteReadNotifications(req.user.userId);
      return {
        success: true,
        message: `Deleted ${count} read notifications`,
        data: { deletedCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to delete read notifications:', error);
      throw new BadRequestException(error.message || 'Failed to delete read notifications');
    }
  }

  /**
   * Get notification statistics for current user
   */
  @Get('stats/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationStats(@Request() req) {
    try {
      this.logger.log(`Fetching notification statistics for user: ${req.user.userId}`);
      const stats = await this.notificationsService.getNotificationStatistics(req.user.userId);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch notification statistics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Send notification to specific user(s)
   */
  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send notification to specific user(s)' })
  @ApiResponse({ status: 201, description: 'Notification(s) sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async sendNotification(
    @Body() body: { recipientIds: string[]; title: string; message: string; type?: string; data?: any },
    @Request() req,
  ) {
    try {
      this.logger.log(`Sending notifications to ${body.recipientIds.length} users by ${req.user.userId}`);
      const notifications = await this.notificationsService.sendNotificationToUsers(
        body.recipientIds,
        body.title,
        body.message,
        body.type,
        body.data,
        req.user.userId,
      );
      return {
        success: true,
        message: 'Notifications sent successfully',
        data: { sentCount: notifications.length },
      };
    } catch (error) {
      this.logger.error('Failed to send notifications:', error);
      throw new BadRequestException(error.message || 'Failed to send notifications');
    }
  }

  /**
   * Broadcast notification to all users
   */
  @Post('broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast notification to all users' })
  @ApiResponse({ status: 201, description: 'Broadcast sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async broadcastNotification(
    @Body() body: { title: string; message: string; type?: string; data?: any },
    @Request() req,
  ) {
    try {
      this.logger.log(`Broadcasting notification to all users by ${req.user.userId}`);
      const count = await this.notificationsService.broadcastNotification(
        body.title,
        body.message,
        body.type,
        body.data,
        req.user.userId,
      );
      return {
        success: true,
        message: 'Broadcast sent successfully',
        data: { sentCount: count },
      };
    } catch (error) {
      this.logger.error('Failed to broadcast notification:', error);
      throw new BadRequestException(error.message || 'Failed to broadcast notification');
    }
  }
}

