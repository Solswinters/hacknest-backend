/**
 * Index Manager - Database index management and optimization
 * HIGH PRIORITY: Performance optimization through proper indexing
 */

import { Model, Connection } from 'mongoose';
import { Logger } from '@nestjs/common';

export interface IndexDefinition {
  fields: Record<string, 1 | -1>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
    name?: string;
    background?: boolean;
  };
}

export interface IndexStats {
  name: string;
  keys: Record<string, number>;
  size: number;
  usageCount: number;
}

export class IndexManager {
  private readonly logger = new Logger(IndexManager.name);

  /**
   * Create indexes for a model
   */
  async createIndexes(
    model: Model<any>,
    indexes: IndexDefinition[]
  ): Promise<void> {
    this.logger.log(`Creating indexes for ${model.modelName}...`);

    for (const index of indexes) {
      try {
        await model.collection.createIndex(index.fields, index.options || {});
        this.logger.log(
          `Created index on ${model.modelName}: ${JSON.stringify(index.fields)}`
        );
      } catch (error) {
        this.logger.error(
          `Failed to create index on ${model.modelName}: ${error.message}`
        );
      }
    }
  }

  /**
   * Drop unused indexes
   */
  async dropUnusedIndexes(
    model: Model<any>,
    keepIndexes: string[] = []
  ): Promise<void> {
    const indexes = await model.collection.indexes();

    for (const index of indexes) {
      const indexName = index.name;

      // Never drop _id index
      if (indexName === '_id_') continue;

      // Skip if in keep list
      if (keepIndexes.includes(indexName)) continue;

      try {
        await model.collection.dropIndex(indexName);
        this.logger.log(`Dropped index ${indexName} from ${model.modelName}`);
      } catch (error) {
        this.logger.error(
          `Failed to drop index ${indexName}: ${error.message}`
        );
      }
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(model: Model<any>): Promise<IndexStats[]> {
    const stats = await model.collection.stats();
    const indexes = await model.collection.indexes();

    return indexes.map((index) => ({
      name: index.name,
      keys: index.key,
      size: stats.indexSizes?.[index.name] || 0,
      usageCount: 0, // Would need to query $indexStats for this
    }));
  }

  /**
   * Analyze slow queries and suggest indexes
   */
  async suggestIndexes(connection: Connection): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Get slow query log
      const profilerData = await connection.db
        .collection('system.profile')
        .find({ millis: { $gt: 100 } })
        .limit(100)
        .toArray();

      for (const query of profilerData) {
        if (query.command?.filter) {
          const fields = Object.keys(query.command.filter);
          if (fields.length > 0) {
            suggestions.push(
              `Consider index on: ${query.ns} - ${JSON.stringify(fields)}`
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not analyze slow queries');
    }

    return suggestions;
  }

  /**
   * Rebuild indexes for better performance
   */
  async rebuildIndexes(model: Model<any>): Promise<void> {
    this.logger.log(`Rebuilding indexes for ${model.modelName}...`);

    try {
      await model.collection.reIndex();
      this.logger.log(`Rebuilt indexes for ${model.modelName}`);
    } catch (error) {
      this.logger.error(
        `Failed to rebuild indexes for ${model.modelName}: ${error.message}`
      );
    }
  }

  /**
   * Validate indexes exist
   */
  async validateIndexes(
    model: Model<any>,
    requiredIndexes: string[]
  ): Promise<boolean> {
    const indexes = await model.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    for (const required of requiredIndexes) {
      if (!indexNames.includes(required)) {
        this.logger.warn(
          `Missing required index ${required} on ${model.modelName}`
        );
        return false;
      }
    }

    return true;
  }
}

/**
 * Common index definitions for models
 */
export const CommonIndexes = {
  // User indexes
  user: [
    {
      fields: { address: 1 },
      options: { unique: true, name: 'address_unique' },
    },
    { fields: { username: 1 }, options: { sparse: true, name: 'username' } },
    { fields: { role: 1 }, options: { name: 'role' } },
    { fields: { createdAt: -1 }, options: { name: 'created_desc' } },
  ] as IndexDefinition[],

  // Event indexes
  event: [
    { fields: { hostAddress: 1 }, options: { name: 'host' } },
    {
      fields: { startDate: 1, endDate: 1 },
      options: { name: 'date_range' },
    },
    { fields: { status: 1 }, options: { name: 'status' } },
    {
      fields: { createdAt: -1 },
      options: { name: 'created_desc' },
    },
    {
      fields: { hostAddress: 1, status: 1 },
      options: { name: 'host_status' },
    },
  ] as IndexDefinition[],

  // Submission indexes
  submission: [
    { fields: { eventId: 1 }, options: { name: 'event' } },
    { fields: { participantId: 1 }, options: { name: 'participant' } },
    {
      fields: { eventId: 1, participantId: 1 },
      options: { name: 'event_participant' },
    },
    { fields: { submittedAt: -1 }, options: { name: 'submitted_desc' } },
    { fields: { status: 1 }, options: { name: 'status' } },
  ] as IndexDefinition[],

  // Job indexes
  job: [
    { fields: { status: 1 }, options: { name: 'status' } },
    {
      fields: { initiatorAddress: 1 },
      options: { name: 'initiator' },
    },
    { fields: { createdAt: -1 }, options: { name: 'created_desc' } },
    {
      fields: { status: 1, createdAt: -1 },
      options: { name: 'status_created' },
    },
  ] as IndexDefinition[],

  // Activity log indexes
  activityLog: [
    { fields: { userId: 1 }, options: { name: 'user' } },
    { fields: { eventType: 1 }, options: { name: 'event_type' } },
    { fields: { timestamp: -1 }, options: { name: 'timestamp_desc' } },
    {
      fields: { userId: 1, timestamp: -1 },
      options: { name: 'user_timestamp' },
    },
    {
      fields: { timestamp: 1 },
      options: {
        name: 'ttl_index',
        expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
      },
    },
  ] as IndexDefinition[],

  // Notification indexes
  notification: [
    { fields: { recipientId: 1 }, options: { name: 'recipient' } },
    { fields: { read: 1 }, options: { name: 'read_status' } },
    {
      fields: { recipientId: 1, read: 1 },
      options: { name: 'recipient_read' },
    },
    { fields: { createdAt: -1 }, options: { name: 'created_desc' } },
    {
      fields: { createdAt: 1 },
      options: {
        name: 'ttl_index',
        expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
      },
    },
  ] as IndexDefinition[],
};

export default IndexManager;

