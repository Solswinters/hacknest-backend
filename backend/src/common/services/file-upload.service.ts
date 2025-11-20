import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedAt: Date;
  uploadedBy?: string;
  metadata?: Record<string, any>;
}

export interface UploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  uploadDir: string;
  urlPrefix: string;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly config: UploadConfig;
  private uploads: Map<string, UploadedFile> = new Map();

  constructor() {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain',
        'application/json',
      ],
      uploadDir: process.env.UPLOAD_DIR || './uploads',
      urlPrefix: process.env.UPLOAD_URL_PREFIX || '/uploads',
    };

    this.initializeUploadDir();
  }

  /**
   * Initialize upload directory
   */
  private async initializeUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.uploadDir, { recursive: true });
      this.logger.log(`Upload directory initialized: ${this.config.uploadDir}`);
    } catch (error) {
      this.logger.error('Failed to initialize upload directory', error);
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: Express.Multer.File,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<UploadedFile> {
    // Validate file size
    if (file.size > this.config.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`
      );
    }

    // Validate MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`
      );
    }

    // Generate unique filename
    const fileId = this.generateFileId(file);
    const ext = path.extname(file.originalname);
    const fileName = `${fileId}${ext}`;
    const filePath = path.join(this.config.uploadDir, fileName);

    // Save file
    try {
      await fs.writeFile(filePath, file.buffer);

      const uploadedFile: UploadedFile = {
        id: fileId,
        originalName: file.originalname,
        fileName,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        url: `${this.config.urlPrefix}/${fileName}`,
        uploadedAt: new Date(),
        uploadedBy: userId,
        metadata,
      };

      this.uploads.set(fileId, uploadedFile);
      this.logger.log(`File uploaded: ${fileName} (${file.size} bytes)`);

      return uploadedFile;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${file.originalname}`, error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<UploadedFile[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, userId, metadata)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Get file by ID
   */
  getFile(fileId: string): UploadedFile | undefined {
    return this.uploads.get(fileId);
  }

  /**
   * Get file path
   */
  getFilePath(fileId: string): string | undefined {
    const file = this.uploads.get(fileId);
    return file?.path;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const file = this.uploads.get(fileId);

    if (!file) {
      return false;
    }

    try {
      await fs.unlink(file.path);
      this.uploads.delete(fileId);
      this.logger.log(`File deleted: ${file.fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${file.fileName}`, error);
      return false;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(fileIds: string[]): Promise<{
    success: string[];
    failed: string[];
  }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const fileId of fileIds) {
      const deleted = await this.deleteFile(fileId);
      if (deleted) {
        success.push(fileId);
      } else {
        failed.push(fileId);
      }
    }

    return { success, failed };
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(file: Express.Multer.File): string {
    const timestamp = Date.now();
    const hash = createHash('md5')
      .update(file.originalname + timestamp)
      .digest('hex');

    return `${timestamp}-${hash.substring(0, 8)}`;
  }

  /**
   * Get file info
   */
  getFileInfo(fileId: string): {
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
    url: string;
    uploadedAt: Date;
  } | null {
    const file = this.uploads.get(fileId);

    if (!file) {
      return null;
    }

    return {
      id: file.id,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      url: file.url,
      uploadedAt: file.uploadedAt,
    };
  }

  /**
   * Get files by user
   */
  getFilesByUser(userId: string): UploadedFile[] {
    return Array.from(this.uploads.values()).filter(
      (file) => file.uploadedBy === userId
    );
  }

  /**
   * Get all files
   */
  getAllFiles(): UploadedFile[] {
    return Array.from(this.uploads.values());
  }

  /**
   * Get total uploaded size
   */
  getTotalUploadedSize(): number {
    return Array.from(this.uploads.values()).reduce(
      (total, file) => total + file.size,
      0
    );
  }

  /**
   * Get upload statistics
   */
  getUploadStats(): {
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    mimeTypeDistribution: Record<string, number>;
  } {
    const files = Array.from(this.uploads.values());
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    const mimeTypeDistribution = files.reduce((acc, file) => {
      acc[file.mimeType] = (acc[file.mimeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFiles: files.length,
      totalSize,
      averageSize: files.length > 0 ? totalSize / files.length : 0,
      mimeTypeDistribution,
    };
  }

  /**
   * Validate file type
   */
  isFileTypeAllowed(mimeType: string): boolean {
    return this.config.allowedMimeTypes.includes(mimeType);
  }

  /**
   * Validate file size
   */
  isFileSizeAllowed(size: number): boolean {
    return size <= this.config.maxFileSize;
  }

  /**
   * Update file metadata
   */
  updateFileMetadata(
    fileId: string,
    metadata: Record<string, any>
  ): boolean {
    const file = this.uploads.get(fileId);

    if (!file) {
      return false;
    }

    file.metadata = {
      ...file.metadata,
      ...metadata,
    };

    return true;
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;

    for (const [fileId, file] of this.uploads.entries()) {
      if (file.uploadedAt < cutoffDate) {
        const deleted = await this.deleteFile(fileId);
        if (deleted) {
          deletedCount++;
        }
      }
    }

    this.logger.log(`Cleaned up ${deletedCount} old files`);
    return deletedCount;
  }

  /**
   * Get upload configuration
   */
  getConfig(): UploadConfig {
    return { ...this.config };
  }

  /**
   * Update upload configuration
   */
  updateConfig(updates: Partial<UploadConfig>): void {
    Object.assign(this.config, updates);
    this.logger.log('Upload configuration updated');
  }
}

export default FileUploadService;

