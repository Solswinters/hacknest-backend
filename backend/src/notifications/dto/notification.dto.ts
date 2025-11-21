import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsMongoId, IsBoolean } from 'class-validator';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  EVENT_REMINDER = 'event_reminder',
  TEAM_INVITATION = 'team_invitation',
  SUBMISSION_FEEDBACK = 'submission_feedback',
  PRIZE_AWARDED = 'prize_awarded',
  PAYOUT_STATUS = 'payout_status',
  NEW_COMMENT = 'new_comment',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID of the recipient user' })
  @IsMongoId()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ description: 'Type of notification', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Additional data related to the notification' })
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Link to a related resource (e.g., event, submission)' })
  @IsOptional()
  @IsString()
  link?: string;
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Type of notification', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Additional data related to the notification' })
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Link to a related resource' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({ description: 'Array of recipient user IDs (if not provided, broadcasts to all users)' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  recipientIds?: string[];

  @ApiPropertyOptional({ description: 'Filter by user role (e.g., "organizer", "judge")' })
  @IsOptional()
  @IsString()
  roleFilter?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'ID of the recipient user' })
  recipientId: string;

  @ApiProperty({ description: 'Type of notification', enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ description: 'Notification message' })
  message: string;

  @ApiProperty({ description: 'Additional data related to the notification' })
  data?: Record<string, any>;

  @ApiProperty({ description: 'Link to a related resource' })
  link?: string;

  @ApiProperty({ description: 'Whether the notification has been read' })
  read: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the notification was read' })
  readAt?: Date;
}

