import { Injectable, Logger } from '@nestjs/common';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression?: string;
  interval?: number;
  runAt?: Date;
  handler: () => Promise<void>;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  runCount: number;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private nextTaskId: number = 0;

  /**
   * Schedule task with interval
   */
  scheduleInterval(
    name: string,
    interval: number,
    handler: () => Promise<void>
  ): string {
    const taskId = `task-${this.nextTaskId++}`;

    const task: ScheduledTask = {
      id: taskId,
      name,
      interval,
      handler,
      enabled: true,
      runCount: 0,
      nextRun: new Date(Date.now() + interval),
    };

    this.tasks.set(taskId, task);
    this.startTask(taskId);

    this.logger.log(`Scheduled task: ${name} (interval: ${interval}ms)`);

    return taskId;
  }

  /**
   * Schedule task at specific time
   */
  scheduleAt(
    name: string,
    runAt: Date,
    handler: () => Promise<void>
  ): string {
    const taskId = `task-${this.nextTaskId++}`;

    const task: ScheduledTask = {
      id: taskId,
      name,
      runAt,
      handler,
      enabled: true,
      runCount: 0,
      nextRun: runAt,
    };

    this.tasks.set(taskId, task);

    const delay = runAt.getTime() - Date.now();

    if (delay > 0) {
      const timer = setTimeout(async () => {
        await this.runTask(taskId);
        this.tasks.delete(taskId);
        this.timers.delete(taskId);
      }, delay);

      this.timers.set(taskId, timer);

      this.logger.log(`Scheduled task: ${name} at ${runAt.toISOString()}`);
    } else {
      this.logger.warn(`Task ${name} scheduled in the past, running immediately`);
      this.runTask(taskId);
    }

    return taskId;
  }

  /**
   * Start task
   */
  private startTask(taskId: string): void {
    const task = this.tasks.get(taskId);

    if (!task || !task.interval) {
      return;
    }

    const timer = setInterval(async () => {
      if (task.enabled) {
        await this.runTask(taskId);
      }
    }, task.interval);

    this.timers.set(taskId, timer);
  }

  /**
   * Run task
   */
  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return;
    }

    this.logger.debug(`Running task: ${task.name}`);

    try {
      await task.handler();
      task.lastRun = new Date();
      task.runCount++;

      if (task.interval) {
        task.nextRun = new Date(Date.now() + task.interval);
      }

      this.logger.debug(`Task completed: ${task.name}`);
    } catch (error: any) {
      this.logger.error(`Task failed: ${task.name} - ${error.message}`);
    }
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): boolean {
    const timer = this.timers.get(taskId);

    if (timer) {
      clearInterval(timer);
      clearTimeout(timer);
      this.timers.delete(taskId);
    }

    const deleted = this.tasks.delete(taskId);

    if (deleted) {
      this.logger.log(`Task cancelled: ${taskId}`);
    }

    return deleted;
  }

  /**
   * Pause task
   */
  pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);

    if (!task) {
      return false;
    }

    task.enabled = false;
    this.logger.log(`Task paused: ${task.name}`);

    return true;
  }

  /**
   * Resume task
   */
  resumeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);

    if (!task) {
      return false;
    }

    task.enabled = true;
    this.logger.log(`Task resumed: ${task.name}`);

    return true;
  }

  /**
   * Get task
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task count
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
      clearTimeout(timer);
    }

    this.timers.clear();
    this.tasks.clear();

    this.logger.log('All tasks cleared');
  }

  /**
   * Run task immediately
   */
  async runNow(taskId: string): Promise<void> {
    await this.runTask(taskId);
  }

  /**
   * Get task stats
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
  } {
    const tasks = this.getAllTasks();

    return {
      total: tasks.length,
      enabled: tasks.filter((t) => t.enabled).length,
      disabled: tasks.filter((t) => !t.enabled).length,
    };
  }
}

export default SchedulerService;

