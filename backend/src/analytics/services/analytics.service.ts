import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';

import { Model } from 'mongoose';

import { ActivityLog, ActivityLogDocument } from '../../common/schemas/activity-log.schema';

export interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  activeEvents: number;
  totalSubmissions: number;
  totalPayouts: number;
  totalPayoutValue: string;
}

export interface EventAnalytics {
  eventId: string;
  participantCount: number;
  submissionCount: number;
  judgeCount: number;
  averageScore: number;
  completionRate: number;
  prizePoolTotal: string;
}

export interface UserAnalytics {
  userId: string;
  eventsParticipated: number;
  eventsHosted: number;
  submissionsCreated: number;
  averageScore: number;
  totalWinnings: string;
  lastActive: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  /**
   * Track an activity/event
   */
  async trackActivity(
    type: string,
    actor: string,
    data?: {
      targetType?: string;
      targetId?: string;
      description: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    try {
      await this.activityLogModel.create({
        type,
        actor,
        ...data,
        isSystem: false,
      });
    } catch (error) {
      this.logger.error(`Failed to track activity: ${error.message}`);
    }
  }

  /**
   * Track system event
   */
  async trackSystemEvent(
    type: string,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.activityLogModel.create({
        type,
        actor: 'system',
        description,
        metadata,
        isSystem: true,
      });
    } catch (error) {
      this.logger.error(`Failed to track system event: ${error.message}`);
    }
  }

  /**
   * Get platform metrics
   */
  async getPlatformMetrics(): Promise<AnalyticsMetrics> {
    // This would query actual collections
    // For now, returning structure
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalEvents: 0,
      activeEvents: 0,
      totalSubmissions: 0,
      totalPayouts: 0,
      totalPayoutValue: '0',
    };
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(eventId: string): Promise<EventAnalytics> {
    const activities = await this.activityLogModel
      .find({
        targetType: 'event',
        targetId: eventId,
      })
      .exec();

    return {
      eventId,
      participantCount: 0,
      submissionCount: 0,
      judgeCount: 0,
      averageScore: 0,
      completionRate: 0,
      prizePoolTotal: '0',
    };
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const activities = await this.activityLogModel
      .find({ actor: userId })
      .sort({ createdAt: -1 })
      .exec();

    return {
      userId,
      eventsParticipated: 0,
      eventsHosted: 0,
      submissionsCreated: 0,
      averageScore: 0,
      totalWinnings: '0',
      lastActive: activities[0]?.createdAt || new Date(),
    };
  }

  /**
   * Get activity timeline
   */
  async getActivityTimeline(
    filters?: {
      startDate?: Date;
      endDate?: Date;
      type?: string;
      actor?: string;
    },
    limit: number = 50,
  ): Promise<ActivityLogDocument[]> {
    const query: any = {};

    if (filters) {
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = filters.startDate;
        if (filters.endDate) query.createdAt.$lte = filters.endDate;
      }
      if (filters.type) query.type = filters.type;
      if (filters.actor) query.actor = filters.actor;
    }

    return this.activityLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get activity count by type
   */
  async getActivityCountByType(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Record<string, number>> {
    const match: any = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    const results = await this.activityLogModel.aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    return results.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get time series data for activity
   */
  async getActivityTimeSeries(
    type: string,
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' = 'day',
  ): Promise<TimeSeriesData[]> {
    const groupBy = {
      hour: { $hour: '$createdAt' },
      day: { $dayOfYear: '$createdAt' },
      week: { $week: '$createdAt' },
    };

    const results = await this.activityLogModel.aggregate([
      {
        $match: {
          type,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            period: groupBy[interval],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.period': 1 } },
    ]);

    return results.map((r) => ({
      timestamp: new Date(), // Would calculate actual timestamp
      value: r.count,
    }));
  }

  /**
   * Get top active users
   */
  async getTopActiveUsers(limit: number = 10): Promise<Array<{
    actor: string;
    activityCount: number;
  }>> {
    const results = await this.activityLogModel.aggregate([
      { $match: { isSystem: false } },
      { $group: { _id: '$actor', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return results.map((r) => ({
      actor: r._id,
      activityCount: r.count,
    }));
  }

  /**
   * Get activity heatmap data
   */
  async getActivityHeatmap(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: string; count: number }>> {
    const results = await this.activityLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    return results.map((r) => ({
      date: `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`,
      count: r.count,
    }));
  }

  /**
   * Get retention metrics
   */
  async getRetentionMetrics(cohortDate: Date): Promise<{
    cohortSize: number;
    retention: Array<{ period: number; rate: number }>;
  }> {
    // Would calculate actual retention based on user activity
    return {
      cohortSize: 0,
      retention: [],
    };
  }

  /**
   * Get conversion funnel
   */
  async getConversionFunnel(): Promise<Array<{
    stage: string;
    count: number;
    conversionRate: number;
  }>> {
    // Would calculate actual funnel stages
    return [
      { stage: 'Registered', count: 0, conversionRate: 100 },
      { stage: 'Event Viewed', count: 0, conversionRate: 0 },
      { stage: 'Event Joined', count: 0, conversionRate: 0 },
      { stage: 'Submission Created', count: 0, conversionRate: 0 },
      { stage: 'Prize Won', count: 0, conversionRate: 0 },
    ];
  }

  /**
   * Clean up old activity logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.activityLogModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    this.logger.log(`Cleaned up ${result.deletedCount} old activity logs`);
    return result.deletedCount;
  }
}

