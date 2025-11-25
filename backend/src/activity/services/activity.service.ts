import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';

import { Model } from 'mongoose';

import { ActivityLog, ActivityLogDocument } from '../../common/schemas/activity-log.schema';

export interface CreateActivityDto {
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityQueryDto {
  userId?: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  totalActivities: number;
  activitiesByType: Record<string, number>;
  activitiesByEntity: Record<string, number>;
  mostActiveUsers: Array<{ userId: string; count: number }>;
  recentActivities: ActivityLogDocument[];
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  /**
   * Log an activity
   */
  async log(createActivityDto: CreateActivityDto): Promise<ActivityLogDocument> {
    const activity = new this.activityLogModel({
      ...createActivityDto,
      timestamp: new Date(),
    });

    const savedActivity = await activity.save();
    this.logger.debug(
      `Activity logged: ${createActivityDto.eventType} by ${createActivityDto.userId}`,
    );

    return savedActivity;
  }

  /**
   * Log user login
   */
  async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      eventType: 'user.login',
      entityType: 'user',
      entityId: userId,
      details: { success: true },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user logout
   */
  async logLogout(userId: string): Promise<void> {
    await this.log({
      userId,
      eventType: 'user.logout',
      entityType: 'user',
      entityId: userId,
    });
  }

  /**
   * Log event creation
   */
  async logEventCreation(userId: string, eventId: string, details?: any): Promise<void> {
    await this.log({
      userId,
      eventType: 'event.created',
      entityType: 'event',
      entityId: eventId,
      details,
    });
  }

  /**
   * Log event update
   */
  async logEventUpdate(userId: string, eventId: string, changes?: any): Promise<void> {
    await this.log({
      userId,
      eventType: 'event.updated',
      entityType: 'event',
      entityId: eventId,
      details: { changes },
    });
  }

  /**
   * Log submission
   */
  async logSubmission(
    userId: string,
    submissionId: string,
    eventId: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'submission.created',
      entityType: 'submission',
      entityId: submissionId,
      details: { eventId },
    });
  }

  /**
   * Log prize award
   */
  async logPrizeAward(
    userId: string,
    prizeId: string,
    winnerId: string,
  ): Promise<void> {
    await this.log({
      userId,
      eventType: 'prize.awarded',
      entityType: 'prize',
      entityId: prizeId,
      details: { winnerId },
    });
  }

  /**
   * Log team action
   */
  async logTeamAction(
    userId: string,
    teamId: string,
    action: 'created' | 'joined' | 'left' | 'disbanded',
  ): Promise<void> {
    await this.log({
      userId,
      eventType: `team.${action}`,
      entityType: 'team',
      entityId: teamId,
    });
  }

  /**
   * Query activities
   */
  async query(queryDto: ActivityQueryDto): Promise<ActivityLogDocument[]> {
    const {
      userId,
      eventType,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = queryDto;

    const query: any = {};

    if (userId) {
      query.userId = userId;
    }

    if (eventType) {
      query.eventType = eventType;
    }

    if (entityType) {
      query.entityType = entityType;
    }

    if (entityId) {
      query.entityId = entityId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
      }
    }

    return this.activityLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * Get user activities
   */
  async getUserActivities(
    userId: string,
    limit: number = 50,
  ): Promise<ActivityLogDocument[]> {
    return this.activityLogModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get activities by entity
   */
  async getEntityActivities(
    entityType: string,
    entityId: string,
    limit: number = 50,
  ): Promise<ActivityLogDocument[]> {
    return this.activityLogModel
      .find({ entityType, entityId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 50): Promise<ActivityLogDocument[]> {
    return this.activityLogModel
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get activity statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<ActivityStats> {
    const query: any = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
      }
    }

    const activities = await this.activityLogModel.find(query).exec();

    // Count by type
    const activitiesByType: Record<string, number> = {};
    const activitiesByEntity: Record<string, number> = {};
    const userActivityCount: Map<string, number> = new Map();

    activities.forEach((activity) => {
      // By type
      activitiesByType[activity.eventType] =
        (activitiesByType[activity.eventType] || 0) + 1;

      // By entity
      activitiesByEntity[activity.entityType] =
        (activitiesByEntity[activity.entityType] || 0) + 1;

      // By user
      const count = userActivityCount.get(activity.userId) || 0;
      userActivityCount.set(activity.userId, count + 1);
    });

    // Get most active users
    const mostActiveUsers = Array.from(userActivityCount.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get recent activities
    const recentActivities = activities.slice(0, 10);

    return {
      totalActivities: activities.length,
      activitiesByType,
      activitiesByEntity,
      mostActiveUsers,
      recentActivities,
    };
  }

  /**
   * Get activity timeline
   */
  async getTimeline(
    entityType: string,
    entityId: string,
  ): Promise<ActivityLogDocument[]> {
    return this.activityLogModel
      .find({ entityType, entityId })
      .sort({ timestamp: 1 })
      .exec();
  }

  /**
   * Get user activity summary
   */
  async getUserSummary(userId: string): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    firstActivity: Date | null;
    lastActivity: Date | null;
    mostCommonActivity: string | null;
  }> {
    const activities = await this.getUserActivities(userId, 1000);

    const activitiesByType: Record<string, number> = {};

    activities.forEach((activity) => {
      activitiesByType[activity.eventType] =
        (activitiesByType[activity.eventType] || 0) + 1;
    });

    // Find most common activity
    let mostCommonActivity: string | null = null;
    let maxCount = 0;

    Object.entries(activitiesByType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonActivity = type;
      }
    });

    return {
      totalActivities: activities.length,
      activitiesByType,
      firstActivity: activities.length > 0 ? activities[activities.length - 1].timestamp : null,
      lastActivity: activities.length > 0 ? activities[0].timestamp : null,
      mostCommonActivity,
    };
  }

  /**
   * Delete old activities
   */
  async deleteOldActivities(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.activityLogModel
      .deleteMany({
        timestamp: { $lt: cutoffDate },
      })
      .exec();

    this.logger.log(`Deleted ${result.deletedCount} old activity logs`);

    return result.deletedCount;
  }

  /**
   * Get activities by date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<ActivityLogDocument[]> {
    const query = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    let queryBuilder = this.activityLogModel
      .find(query)
      .sort({ timestamp: -1 });

    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    return queryBuilder.exec();
  }

  /**
   * Get activity heatmap
   */
  async getHeatmap(
    userId: string,
    days: number = 30,
  ): Promise<Record<string, number>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.activityLogModel
      .find({
        userId,
        timestamp: { $gte: startDate },
      })
      .exec();

    const heatmap: Record<string, number> = {};

    activities.forEach((activity) => {
      const dateKey = activity.timestamp.toISOString().split('T')[0];
      heatmap[dateKey] = (heatmap[dateKey] || 0) + 1;
    });

    return heatmap;
  }

  /**
   * Search activities
   */
  async search(
    searchTerm: string,
    limit: number = 50,
  ): Promise<ActivityLogDocument[]> {
    return this.activityLogModel
      .find({
        $or: [
          { eventType: { $regex: searchTerm, $options: 'i' } },
          { entityType: { $regex: searchTerm, $options: 'i' } },
          { 'details.description': { $regex: searchTerm, $options: 'i' } },
        ],
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get count of activities
   */
  async getCount(queryDto?: ActivityQueryDto): Promise<number> {
    if (!queryDto) {
      return this.activityLogModel.countDocuments().exec();
    }

    const { userId, eventType, entityType, entityId, startDate, endDate } =
      queryDto;

    const query: any = {};

    if (userId) query.userId = userId;
    if (eventType) query.eventType = eventType;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    return this.activityLogModel.countDocuments(query).exec();
  }
}

