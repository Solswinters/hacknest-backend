/**
 * Backup Service - Automated backup and restore for database and files
 * INFRASTRUCTURE: Critical for data protection and disaster recovery
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  maxBackups: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  databases: string[];
}

export interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental';
  timestamp: Date;
  size: number;
  databases: string[];
  filePath: string;
  compressed: boolean;
  encrypted: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  duration?: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private backups: Map<string, BackupMetadata> = new Map();
  private config: BackupConfig;
  private backupInProgress = false;

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      backupDir: config?.backupDir || './backups',
      retentionDays: config?.retentionDays || 30,
      maxBackups: config?.maxBackups || 10,
      compressionEnabled: config?.compressionEnabled !== false,
      encryptionEnabled: config?.encryptionEnabled || false,
      databases: config?.databases || ['hacknest'],
    };

    this.ensureBackupDirectory();
    this.loadBackupMetadata();
  }

  /**
   * Create a backup
   */
  async createBackup(
    type: 'full' | 'incremental' = 'full'
  ): Promise<BackupMetadata> {
    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const backupId = this.generateBackupId();
    const startTime = Date.now();

    const metadata: BackupMetadata = {
      id: backupId,
      type,
      timestamp: new Date(),
      size: 0,
      databases: this.config.databases,
      filePath: '',
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled,
      status: 'in_progress',
    };

    this.backups.set(backupId, metadata);

    try {
      this.logger.log(`Starting ${type} backup: ${backupId}`);

      // Create backup directory for this backup
      const backupPath = path.join(
        this.config.backupDir,
        `backup_${backupId}`
      );
      await this.createDirectory(backupPath);

      // Backup each database
      for (const database of this.config.databases) {
        await this.backupDatabase(database, backupPath);
      }

      // Compress if enabled
      let finalPath = backupPath;
      if (this.config.compressionEnabled) {
        finalPath = await this.compressBackup(backupPath);
      }

      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        finalPath = await this.encryptBackup(finalPath);
      }

      // Get backup size
      const size = await this.getDirectorySize(finalPath);

      // Update metadata
      metadata.filePath = finalPath;
      metadata.size = size;
      metadata.status = 'completed';
      metadata.duration = Date.now() - startTime;

      this.logger.log(
        `Backup completed: ${backupId} (${this.formatBytes(size)}, ${metadata.duration}ms)`
      );

      // Cleanup old backups
      await this.cleanupOldBackups();

      // Save metadata
      await this.saveBackupMetadata();

      return metadata;
    } catch (error) {
      this.logger.error(`Backup failed: ${backupId}`, error);

      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : 'Unknown error';

      throw error;
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const metadata = this.backups.get(backupId);

    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (metadata.status !== 'completed') {
      throw new Error(`Backup is not in completed state: ${backupId}`);
    }

    this.logger.log(`Starting restore from backup: ${backupId}`);

    try {
      let restorePath = metadata.filePath;

      // Decrypt if needed
      if (metadata.encrypted) {
        restorePath = await this.decryptBackup(restorePath);
      }

      // Decompress if needed
      if (metadata.compressed) {
        restorePath = await this.decompressBackup(restorePath);
      }

      // Restore each database
      for (const database of metadata.databases) {
        await this.restoreDatabase(database, restorePath);
      }

      this.logger.log(`Restore completed from backup: ${backupId}`);
    } catch (error) {
      this.logger.error(`Restore failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * List all backups
   */
  listBackups(): BackupMetadata[] {
    return Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId: string): BackupMetadata | undefined {
    return this.backups.get(backupId);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const metadata = this.backups.get(backupId);

    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    try {
      // Delete backup files
      await this.deleteDirectory(metadata.filePath);

      // Remove from map
      this.backups.delete(backupId);

      // Save metadata
      await this.saveBackupMetadata();

      this.logger.log(`Backup deleted: ${backupId}`);
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Backup database
   */
  private async backupDatabase(
    database: string,
    backupPath: string
  ): Promise<void> {
    const outputFile = path.join(backupPath, `${database}.dump`);

    // Using mongodump for MongoDB
    const command = `mongodump --db=${database} --out=${backupPath}`;

    try {
      await execAsync(command);
      this.logger.debug(`Database backed up: ${database}`);
    } catch (error) {
      this.logger.error(`Database backup failed: ${database}`, error);
      throw error;
    }
  }

  /**
   * Restore database
   */
  private async restoreDatabase(
    database: string,
    restorePath: string
  ): Promise<void> {
    const dumpPath = path.join(restorePath, database);

    // Using mongorestore for MongoDB
    const command = `mongorestore --db=${database} --drop ${dumpPath}`;

    try {
      await execAsync(command);
      this.logger.debug(`Database restored: ${database}`);
    } catch (error) {
      this.logger.error(`Database restore failed: ${database}`, error);
      throw error;
    }
  }

  /**
   * Compress backup
   */
  private async compressBackup(backupPath: string): Promise<string> {
    const compressedPath = `${backupPath}.tar.gz`;
    const command = `tar -czf ${compressedPath} -C ${path.dirname(backupPath)} ${path.basename(backupPath)}`;

    try {
      await execAsync(command);

      // Remove uncompressed backup
      await this.deleteDirectory(backupPath);

      this.logger.debug(`Backup compressed: ${compressedPath}`);
      return compressedPath;
    } catch (error) {
      this.logger.error('Compression failed', error);
      throw error;
    }
  }

  /**
   * Decompress backup
   */
  private async decompressBackup(compressedPath: string): Promise<string> {
    const extractPath = compressedPath.replace('.tar.gz', '');
    const command = `tar -xzf ${compressedPath} -C ${path.dirname(compressedPath)}`;

    try {
      await execAsync(command);
      this.logger.debug(`Backup decompressed: ${extractPath}`);
      return extractPath;
    } catch (error) {
      this.logger.error('Decompression failed', error);
      throw error;
    }
  }

  /**
   * Encrypt backup (placeholder for actual encryption)
   */
  private async encryptBackup(backupPath: string): Promise<string> {
    // In production, use proper encryption (e.g., GPG, OpenSSL)
    this.logger.warn('Encryption not implemented - using placeholder');
    return backupPath;
  }

  /**
   * Decrypt backup (placeholder for actual decryption)
   */
  private async decryptBackup(encryptedPath: string): Promise<string> {
    // In production, use proper decryption
    this.logger.warn('Decryption not implemented - using placeholder');
    return encryptedPath;
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = this.listBackups();

    // Remove backups exceeding max count
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.slice(this.config.maxBackups);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }

    // Remove backups older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    for (const backup of backups) {
      if (backup.timestamp < cutoffDate) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  /**
   * Get directory size
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`du -sb ${dirPath}`);
      return parseInt(stdout.split('\t')[0]);
    } catch (error) {
      this.logger.error('Failed to get directory size', error);
      return 0;
    }
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Create directory
   */
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * Delete directory
   */
  private async deleteDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.error(`Failed to delete directory: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(): Promise<void> {
    const metadataPath = path.join(this.config.backupDir, 'metadata.json');
    const data = Array.from(this.backups.entries());

    try {
      await fs.promises.writeFile(metadataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save backup metadata', error);
    }
  }

  /**
   * Load backup metadata
   */
  private loadBackupMetadata(): void {
    const metadataPath = path.join(this.config.backupDir, 'metadata.json');

    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf-8');
        const entries = JSON.parse(data);

        this.backups = new Map(
          entries.map(([id, metadata]: [string, BackupMetadata]) => [
            id,
            {
              ...metadata,
              timestamp: new Date(metadata.timestamp),
            },
          ])
        );
      }
    } catch (error) {
      this.logger.error('Failed to load backup metadata', error);
    }
  }

  /**
   * Get backup statistics
   */
  getStatistics(): {
    totalBackups: number;
    totalSize: number;
    completedBackups: number;
    failedBackups: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  } {
    const backups = this.listBackups();

    let totalSize = 0;
    let completedBackups = 0;
    let failedBackups = 0;
    let oldestBackup: Date | null = null;
    let newestBackup: Date | null = null;

    for (const backup of backups) {
      totalSize += backup.size;

      if (backup.status === 'completed') completedBackups++;
      if (backup.status === 'failed') failedBackups++;

      if (!oldestBackup || backup.timestamp < oldestBackup) {
        oldestBackup = backup.timestamp;
      }

      if (!newestBackup || backup.timestamp > newestBackup) {
        newestBackup = backup.timestamp;
      }
    }

    return {
      totalBackups: backups.length,
      totalSize,
      completedBackups,
      failedBackups,
      oldestBackup,
      newestBackup,
    };
  }
}

export default BackupService;
