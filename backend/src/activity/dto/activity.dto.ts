import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsMongoId, IsDate, IsEnum } from 'class-validator';

export enum ActivityAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGGED_IN = 'user_logged_in',
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  EVENT_DELETED = 'event_deleted',
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_UPDATED = 'submission_updated',
  SUBMISSION_DELETED = 'submission_deleted',
  TEAM_CREATED = 'team_created',
  TEAM_JOINED = 'team_joined',
  TEAM_LEFT = 'team_left',
  PRIZE_AWARDED = 'prize_awarded',
  PAYOUT_INITIATED = 'payout_initiated',
  PAYOUT_COMPLETED = 'payout_completed',
  COMMENT_ADDED = 'comment_added',
  VOTE_CAST = 'vote_cast',
}

export class ActivityLogResponseDto {
  @ApiProperty({ description: 'Activity log ID' })
  id: string;

  @ApiProperty({ description: 'ID of the user who performed the action' })
  userId: string;

  @ApiProperty({ description: 'Type of action performed', enum: ActivityAction })
  action: ActivityAction;

  @ApiProperty({ description: 'Type of entity the action was performed on (e.g., "event", "submission")' })
  entityType: string;

  @ApiProperty({ description: 'ID of the entity the action was performed on' })
  entityId: string;

  @ApiPropertyOptional({ description: 'Additional details about the action' })
  details?: Record<string, any>;

  @ApiProperty({ description: 'IP address from which the action was performed' })
  ipAddress?: string;

  @ApiProperty({ description: 'User agent string' })
  userAgent?: string;

  @ApiProperty({ description: 'Timestamp when the action was performed' })
  createdAt: Date;
}

export class SystemStatsDto {
  @ApiProperty({ description: 'Total number of users' })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of events' })
  totalEvents: number;

  @ApiProperty({ description: 'Total number of submissions' })
  totalSubmissions: number;

  @ApiProperty({ description: 'Total number of teams' })
  totalTeams: number;

  @ApiProperty({ description: 'Total number of prizes awarded' })
  totalPrizesAwarded: number;

  @ApiProperty({ description: 'Total value of prizes in USD' })
  totalPrizeValueUSD: number;

  @ApiProperty({ description: 'Active users in the last 30 days' })
  activeUsersLast30Days: number;

  @ApiProperty({ description: 'Events created in the last 30 days' })
  eventsCreatedLast30Days: number;
}

export class PopularEventDto {
  @ApiProperty({ description: 'Event ID' })
  eventId: string;

  @ApiProperty({ description: 'Event name' })
  eventName: string;

  @ApiProperty({ description: 'Number of participants' })
  participantCount: number;

  @ApiProperty({ description: 'Number of submissions' })
  submissionCount: number;

  @ApiProperty({ description: 'Activity score (computed based on various factors)' })
  activityScore: number;
}

export class ActiveUserDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Username or display name' })
  username: string;

  @ApiProperty({ description: 'Number of activities performed' })
  activityCount: number;

  @ApiProperty({ description: 'Number of events participated in' })
  eventsParticipated: number;

  @ApiProperty({ description: 'Number of submissions made' })
  submissionsCount: number;
}

