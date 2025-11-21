import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string | number; // cron string or interval in ms
  handler: () => Promise<void> | void;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failCount: number;
}

export interface TaskResult {
  success: boolean;
  duration: number;
  error?: Error;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  async onModuleInit(): Promise<void> {
    this.isRunning = true;
    this.logger.log('Scheduler service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
    this.stopAll();
    this.logger.log('Scheduler service destroyed');
  }

  /**
   * Schedule a task with interval (in milliseconds)
   */
  scheduleInterval(id: string, name: string, intervalMs: number, handler: () => Promise<void> | void): void {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id "${id}" already exists`);
    }

    const task: ScheduledTask = {
      id,
      name,
      schedule: intervalMs,
      handler,
      enabled: true,
      runCount: 0,
      failCount: 0,
    };

    this.tasks.set(id, task);
    this.startTask(id);
    this.logger.log(`Scheduled interval task: ${name} (${intervalMs}ms)`);
  }

  /**
   * Schedule a cron task
   */
  scheduleCron(id: string, name: string, cronExpression: string, handler: () => Promise<void> | void): void {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id "${id}" already exists`);
    }

    const task: ScheduledTask = {
      id,
      name,
      schedule: cronExpression,
      handler,
      enabled: true,
      runCount: 0,
      failCount: 0,
      nextRun: this.getNextCronRun(cronExpression),
    };

    this.tasks.set(id, task);
    this.startCronTask(id);
    this.logger.log(`Scheduled cron task: ${name} (${cronExpression})`);
  }

  /**
   * Schedule a one-time task
   */
  scheduleOnce(id: string, name: string, delayMs: number, handler: () => Promise<void> | void): void {
    const task: ScheduledTask = {
      id,
      name,
      schedule: delayMs,
      handler,
      enabled: true,
      runCount: 0,
      failCount: 0,
    };

    this.tasks.set(id, task);

    const timer = setTimeout(async () => {
      await this.executeTask(id);
      this.tasks.delete(id);
      this.timers.delete(id);
    }, delayMs);

    this.timers.set(id, timer);
    this.logger.log(`Scheduled one-time task: ${name} (${delayMs}ms)`);
  }

  /**
   * Start a scheduled task
   */
  private startTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task || !task.enabled) return;

    if (typeof task.schedule !== 'number') {
      throw new Error('Invalid schedule type for interval task');
    }

    const timer = setInterval(async () => {
      if (this.isRunning && task.enabled) {
        await this.executeTask(id);
      }
    }, task.schedule);

    this.timers.set(id, timer);
  }

  /**
   * Start a cron task
   */
  private startCronTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task || !task.enabled) return;

    if (typeof task.schedule !== 'string') {
      throw new Error('Invalid schedule type for cron task');
    }

    this.scheduleCronCheck(id);
  }

  /**
   * Schedule cron check
   */
  private scheduleCronCheck(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;

    // Check every minute if it's time to run
    const timer = setInterval(async () => {
      if (!this.isRunning || !task.enabled) return;

      const now = new Date();
      if (task.nextRun && now >= task.nextRun) {
        await this.executeTask(id);

        // Calculate next run
        if (typeof task.schedule === 'string') {
          task.nextRun = this.getNextCronRun(task.schedule);
        }
      }
    }, 60000); // Check every minute

    this.timers.set(id, timer);
  }

  /**
   * Execute a task
   */
  private async executeTask(id: string): Promise<TaskResult> {
    const task = this.tasks.get(id);
    if (!task) {
      return { success: false, duration: 0, error: new Error('Task not found') };
    }

    const startTime = Date.now();
    task.lastRun = new Date();

    try {
      this.logger.debug(`Executing task: ${task.name}`);
      await task.handler();
      task.runCount++;

      const duration = Date.now() - startTime;
      this.logger.debug(`Task completed: ${task.name} (${duration}ms)`);

      return { success: true, duration };
    } catch (error) {
      task.failCount++;
      const duration = Date.now() - startTime;

      this.logger.error(`Task failed: ${task.name}`, error);

      return {
        success: false,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Stop a task
   */
  stop(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    const task = this.tasks.get(id);
    if (task) {
      task.enabled = false;
      this.logger.log(`Stopped task: ${task.name}`);
    }
  }

  /**
   * Stop all tasks
   */
  stopAll(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();

    this.tasks.forEach((task) => {
      task.enabled = false;
    });

    this.logger.log('All tasks stopped');
  }

  /**
   * Resume a task
   */
  resume(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found`);
    }

    task.enabled = true;

    if (typeof task.schedule === 'number') {
      this.startTask(id);
    } else {
      this.startCronTask(id);
    }

    this.logger.log(`Resumed task: ${task.name}`);
  }

  /**
   * Remove a task
   */
  remove(id: string): void {
    this.stop(id);
    this.tasks.delete(id);
    this.logger.log(`Removed task: ${id}`);
  }

  /**
   * Get task by id
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): ScheduledTask[] {
    return this.getTasks().filter((task) => task.enabled);
  }

  /**
   * Run task immediately
   */
  async runNow(id: string): Promise<TaskResult> {
    return await this.executeTask(id);
  }

  /**
   * Get task statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    disabled: number;
    totalRuns: number;
    totalFailures: number;
  } {
    const tasks = this.getTasks();

    return {
      total: tasks.length,
      active: tasks.filter((t) => t.enabled).length,
      disabled: tasks.filter((t) => !t.enabled).length,
      totalRuns: tasks.reduce((sum, t) => sum + t.runCount, 0),
      totalFailures: tasks.reduce((sum, t) => sum + t.failCount, 0),
    };
  }

  /**
   * Parse simple cron expression and get next run time
   * Format: "minute hour dayOfMonth month dayOfWeek"
   * Simplified implementation for common cases
   */
  private getNextCronRun(cronExpression: string): Date {
    // This is a simplified implementation
    // For production, use a proper cron parser library like 'cron-parser'

    const now = new Date();
    const parts = cronExpression.split(' ');

    if (parts.length !== 5) {
      throw new Error('Invalid cron expression format');
    }

    // For simplicity, handle common patterns
    const [minute, hour] = parts;

    const nextRun = new Date(now);

    // Handle specific minute and hour
    if (minute !== '*' && hour !== '*') {
      nextRun.setHours(parseInt(hour));
      nextRun.setMinutes(parseInt(minute));
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);

      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
    // Handle every hour at specific minute
    else if (minute !== '*' && hour === '*') {
      nextRun.setMinutes(parseInt(minute));
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);

      // If minute has passed this hour, go to next hour
      if (nextRun <= now) {
        nextRun.setHours(nextRun.getHours() + 1);
      }
    }
    // Handle every minute
    else if (minute === '*') {
      nextRun.setMinutes(nextRun.getMinutes() + 1);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
    }

    return nextRun;
  }

  /**
   * Register common scheduled tasks
   */
  registerCommonTasks(): void {
    // Example: Clean up old data every day at 2 AM
    this.scheduleCron('cleanup-old-data', 'Cleanup old data', '0 2 * * *', async () => {
      this.logger.log('Running cleanup task...');
      // Implement cleanup logic
    });

    // Example: Sync data every hour
    this.scheduleInterval('sync-data', 'Sync data', 3600000, async () => {
      this.logger.log('Running sync task...');
      // Implement sync logic
    });

    // Example: Health check every 5 minutes
    this.scheduleInterval('health-check', 'Health check', 300000, async () => {
      this.logger.debug('Running health check...');
      // Implement health check logic
    });
  }
}
