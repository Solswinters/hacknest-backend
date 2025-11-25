import { Injectable, LogLevel } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

export interface LoggerOptions {
  level: LogLevel;
  logToFile: boolean;
  logDir: string;
  maxFileSize: number;
  maxFiles: number;
  format: 'json' | 'text';
}

@Injectable()
export class LoggerService {
  private options: LoggerOptions;
  private logBuffer: LogEntry[] = [];
  private currentLogFile: string = '';

  constructor() {
    this.options = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'log',
      logToFile: process.env.LOG_TO_FILE === 'true',
      logDir: process.env.LOG_DIR || './logs',
      maxFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '10485760', 10), // 10MB
      maxFiles: parseInt(process.env.MAX_LOG_FILES || '5', 10),
      format: (process.env.LOG_FORMAT as 'json' | 'text') || 'json',
    };

    if (this.options.logToFile) {
      this.ensureLogDirectory();
      this.rotateLogFile();
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  /**
   * Rotate log file
   */
  private rotateLogFile(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.options.logDir, `app-${timestamp}.log`);

    // Check file size and rotate if needed
    if (fs.existsSync(this.currentLogFile)) {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.options.maxFileSize) {
        const rotatedFile = path.join(
          this.options.logDir,
          `app-${timestamp}-${Date.now()}.log`
        );
        fs.renameSync(this.currentLogFile, rotatedFile);
      }
    }

    // Clean old log files
    this.cleanOldLogFiles();
  }

  /**
   * Clean old log files
   */
  private cleanOldLogFiles(): void {
    const files = fs
      .readdirSync(this.options.logDir)
      .filter((file) => file.startsWith('app-') && file.endsWith('.log'))
      .map((file) => ({
        name: file,
        path: path.join(this.options.logDir, file),
        time: fs.statSync(path.join(this.options.logDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > this.options.maxFiles) {
      files.slice(this.options.maxFiles).forEach((file) => {
        fs.unlinkSync(file.path);
      });
    }
  }

  /**
   * Write log entry
   */
  private writeLog(entry: LogEntry): void {
    // Console output
    this.writeToConsole(entry);

    // File output
    if (this.options.logToFile) {
      this.writeToFile(entry);
    }

    // Buffer for retrieval
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 1000) {
      this.logBuffer.shift();
    }
  }

  /**
   * Write to console
   */
  private writeToConsole(entry: LogEntry): void {
    const message = this.formatMessage(entry);

    switch (entry.level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      case 'verbose':
        console.log(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Write to file
   */
  private writeToFile(entry: LogEntry): void {
    const line =
      this.options.format === 'json'
        ? JSON.stringify(entry) + '\n'
        : this.formatMessage(entry) + '\n';

    fs.appendFileSync(this.currentLogFile, line);
  }

  /**
   * Format message
   */
  private formatMessage(entry: LogEntry): string {
    let message = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;

    if (entry.metadata) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.stackTrace) {
      message += `\n${entry.stackTrace}`;
    }

    return message;
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    context: string,
    message: string,
    metadata?: Record<string, any>,
    stackTrace?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      metadata,
      stackTrace,
    };
  }

  /**
   * Log
   */
  log(message: string, context: string = 'Application', metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('log', context, message, metadata);
    this.writeLog(entry);
  }

  /**
   * Error
   */
  error(
    message: string,
    trace?: string,
    context: string = 'Application',
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry('error', context, message, metadata, trace);
    this.writeLog(entry);
  }

  /**
   * Warn
   */
  warn(message: string, context: string = 'Application', metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', context, message, metadata);
    this.writeLog(entry);
  }

  /**
   * Debug
   */
  debug(message: string, context: string = 'Application', metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', context, message, metadata);
    this.writeLog(entry);
  }

  /**
   * Verbose
   */
  verbose(message: string, context: string = 'Application', metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('verbose', context, message, metadata);
    this.writeLog(entry);
  }

  /**
   * Get logs
   */
  getLogs(limit: number = 100): LogEntry[] {
    return this.logBuffer.slice(-limit);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.logBuffer.filter((entry) => entry.level === level).slice(-limit);
  }

  /**
   * Get logs by context
   */
  getLogsByContext(context: string, limit: number = 100): LogEntry[] {
    return this.logBuffer.filter((entry) => entry.context === context).slice(-limit);
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Get log level
   */
  getLogLevel(): LogLevel {
    return this.options.level;
  }

  /**
   * Enable file logging
   */
  enableFileLogging(): void {
    this.options.logToFile = true;
    this.ensureLogDirectory();
    this.rotateLogFile();
  }

  /**
   * Disable file logging
   */
  disableFileLogging(): void {
    this.options.logToFile = false;
  }
}

export default LoggerService;

