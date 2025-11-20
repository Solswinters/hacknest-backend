import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from '../schemas/notification.schema';

export interface SendEmailDto {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  id: string;
  subject: string;
  html: string;
  text?: string;
  requiredVariables: string[];
}

export interface EmailQueueItem {
  id: string;
  email: SendEmailDto;
  priority: 'high' | 'normal' | 'low';
  retries: number;
  maxRetries: number;
  scheduledFor?: Date;
  createdAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private queue: EmailQueueItem[] = [];
  private templates: Map<string, EmailTemplate> = new Map();
  private isProcessing: boolean = false;
  private nextEmailId: number = 0;

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {
    this.initializeTemplates();
  }

  /**
   * Initialize email templates
   */
  private initializeTemplates(): void {
    // Welcome email
    this.registerTemplate({
      id: 'welcome',
      subject: 'Welcome to HackNest!',
      html: `
        <h1>Welcome {{name}}!</h1>
        <p>Thank you for joining HackNest. We're excited to have you as part of our community.</p>
        <p>Get started by exploring upcoming hackathons and events.</p>
        <a href="{{dashboardUrl}}">Go to Dashboard</a>
      `,
      requiredVariables: ['name', 'dashboardUrl'],
    });

    // Event invitation
    this.registerTemplate({
      id: 'event-invitation',
      subject: 'You\'re invited to {{eventName}}!',
      html: `
        <h1>{{eventName}}</h1>
        <p>You've been invited to participate in {{eventName}}.</p>
        <p><strong>Date:</strong> {{eventDate}}</p>
        <p><strong>Location:</strong> {{eventLocation}}</p>
        <p>{{eventDescription}}</p>
        <a href="{{eventUrl}}">View Event Details</a>
      `,
      requiredVariables: ['eventName', 'eventDate', 'eventLocation', 'eventUrl'],
    });

    // Submission confirmation
    this.registerTemplate({
      id: 'submission-confirmation',
      subject: 'Submission Received - {{eventName}}',
      html: `
        <h1>Submission Confirmed!</h1>
        <p>Your submission for {{eventName}} has been received successfully.</p>
        <p><strong>Project:</strong> {{projectName}}</p>
        <p><strong>Submitted:</strong> {{submissionDate}}</p>
        <p>Good luck! Winners will be announced on {{announcementDate}}.</p>
        <a href="{{submissionUrl}}">View Submission</a>
      `,
      requiredVariables: ['eventName', 'projectName', 'submissionDate', 'submissionUrl'],
    });

    // Prize award notification
    this.registerTemplate({
      id: 'prize-awarded',
      subject: 'Congratulations! You won {{prizeName}}',
      html: `
        <h1>🎉 Congratulations!</h1>
        <p>You've won the {{prizeName}} prize in {{eventName}}!</p>
        <p><strong>Prize Amount:</strong> {{prizeAmount}}</p>
        <p>Your prize will be processed and sent to your wallet address within 7 business days.</p>
        <a href="{{prizeUrl}}">View Prize Details</a>
      `,
      requiredVariables: ['prizeName', 'eventName', 'prizeAmount', 'prizeUrl'],
    });

    // Team invitation
    this.registerTemplate({
      id: 'team-invitation',
      subject: 'You\'ve been invited to join {{teamName}}',
      html: `
        <h1>Team Invitation</h1>
        <p>{{inviterName}} has invited you to join their team "{{teamName}}".</p>
        <p><strong>Event:</strong> {{eventName}}</p>
        <a href="{{acceptUrl}}">Accept Invitation</a>
        <a href="{{declineUrl}}">Decline</a>
      `,
      requiredVariables: ['teamName', 'inviterName', 'eventName', 'acceptUrl', 'declineUrl'],
    });

    // Password reset
    this.registerTemplate({
      id: 'password-reset',
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset Request</h1>
        <p>We received a request to reset your password.</p>
        <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
        <a href="{{resetUrl}}">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      requiredVariables: ['resetUrl'],
    });

    // Event reminder
    this.registerTemplate({
      id: 'event-reminder',
      subject: 'Reminder: {{eventName}} starts soon!',
      html: `
        <h1>Event Reminder</h1>
        <p>{{eventName}} starts in {{timeUntilStart}}!</p>
        <p><strong>Start Time:</strong> {{startTime}}</p>
        <p>Don't forget to prepare your submission.</p>
        <a href="{{eventUrl}}">Go to Event</a>
      `,
      requiredVariables: ['eventName', 'timeUntilStart', 'startTime', 'eventUrl'],
    });

    // Judging notification
    this.registerTemplate({
      id: 'judging-notification',
      subject: 'You\'ve been selected as a judge for {{eventName}}',
      html: `
        <h1>Judge Invitation</h1>
        <p>You've been selected to judge submissions for {{eventName}}.</p>
        <p><strong>Number of Submissions:</strong> {{submissionCount}}</p>
        <p><strong>Judging Deadline:</strong> {{deadline}}</p>
        <a href="{{judgingUrl}}">Start Judging</a>
      `,
      requiredVariables: ['eventName', 'submissionCount', 'deadline', 'judgingUrl'],
    });
  }

  /**
   * Register a new email template
   */
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Send an email
   */
  async send(emailDto: SendEmailDto): Promise<void> {
    this.logger.log(`Sending email to ${emailDto.to}`);

    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, log the email
    this.logger.debug('Email content:', {
      to: emailDto.to,
      subject: emailDto.subject,
      hasHtml: !!emailDto.html,
      hasText: !!emailDto.text,
    });

    // Store notification in database
    if (Array.isArray(emailDto.to)) {
      for (const recipient of emailDto.to) {
        await this.createNotificationRecord(recipient, emailDto);
      }
    } else {
      await this.createNotificationRecord(emailDto.to, emailDto);
    }
  }

  /**
   * Send email from template
   */
  async sendFromTemplate(
    to: string | string[],
    templateId: string,
    context: Record<string, any>,
    options?: Partial<SendEmailDto>
  ): Promise<void> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Email template "${templateId}" not found`);
    }

    // Validate required variables
    const missingVars = template.requiredVariables.filter(
      (variable) => !context[variable]
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required variables for template "${templateId}": ${missingVars.join(', ')}`
      );
    }

    // Replace variables in template
    const html = this.replaceVariables(template.html, context);
    const subject = this.replaceVariables(template.subject, context);
    const text = template.text ? this.replaceVariables(template.text, context) : undefined;

    await this.send({
      to,
      subject,
      html,
      text,
      ...options,
    });
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] !== undefined ? context[variable] : match;
    });
  }

  /**
   * Queue an email for sending
   */
  queueEmail(
    email: SendEmailDto,
    options?: {
      priority?: 'high' | 'normal' | 'low';
      scheduledFor?: Date;
      maxRetries?: number;
    }
  ): string {
    const id = `email-${this.nextEmailId++}`;

    const queueItem: EmailQueueItem = {
      id,
      email,
      priority: options?.priority || 'normal',
      retries: 0,
      maxRetries: options?.maxRetries || 3,
      scheduledFor: options?.scheduledFor,
      createdAt: new Date(),
    };

    this.queue.push(queueItem);
    this.sortQueue();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };

    this.queue.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      // Check if scheduled for later
      if (item.scheduledFor && item.scheduledFor > new Date()) {
        break;
      }

      try {
        await this.send(item.email);
        this.queue.shift(); // Remove from queue
      } catch (error) {
        this.logger.error(`Failed to send email ${item.id}:`, error);

        item.retries++;

        if (item.retries >= item.maxRetries) {
          this.logger.error(`Max retries reached for email ${item.id}`);
          this.queue.shift(); // Remove from queue
        } else {
          // Move to end of queue
          this.queue.push(this.queue.shift()!);
        }
      }

      // Small delay between emails
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(
    recipientId: string,
    emailDto: SendEmailDto
  ): Promise<void> {
    await this.notificationModel.create({
      recipientId,
      type: 'email',
      message: emailDto.subject,
      read: false,
      createdAt: new Date(),
      data: {
        subject: emailDto.subject,
        hasHtml: !!emailDto.html,
        hasText: !!emailDto.text,
      },
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    await this.sendFromTemplate(userEmail, 'welcome', {
      name: userName,
      dashboardUrl: process.env.DASHBOARD_URL || 'https://hacknest.io/dashboard',
    });
  }

  /**
   * Send event invitation
   */
  async sendEventInvitation(
    userEmail: string,
    eventName: string,
    eventDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(userEmail, 'event-invitation', {
      eventName,
      eventDate: eventDetails.date,
      eventLocation: eventDetails.location,
      eventDescription: eventDetails.description,
      eventUrl: eventDetails.url,
    });
  }

  /**
   * Send submission confirmation
   */
  async sendSubmissionConfirmation(
    userEmail: string,
    eventName: string,
    submissionDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(userEmail, 'submission-confirmation', {
      eventName,
      projectName: submissionDetails.projectName,
      submissionDate: new Date().toLocaleDateString(),
      submissionUrl: submissionDetails.url,
      announcementDate: submissionDetails.announcementDate,
    });
  }

  /**
   * Send prize award notification
   */
  async sendPrizeAwardNotification(
    userEmail: string,
    prizeName: string,
    prizeDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(userEmail, 'prize-awarded', {
      prizeName,
      eventName: prizeDetails.eventName,
      prizeAmount: prizeDetails.amount,
      prizeUrl: prizeDetails.url,
    });
  }

  /**
   * Send team invitation
   */
  async sendTeamInvitation(
    userEmail: string,
    teamName: string,
    inviterName: string,
    invitationDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(userEmail, 'team-invitation', {
      teamName,
      inviterName,
      eventName: invitationDetails.eventName,
      acceptUrl: invitationDetails.acceptUrl,
      declineUrl: invitationDetails.declineUrl,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(userEmail: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await this.sendFromTemplate(userEmail, 'password-reset', {
      resetUrl,
    });
  }

  /**
   * Send event reminder
   */
  async sendEventReminder(
    userEmail: string,
    eventName: string,
    eventDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(userEmail, 'event-reminder', {
      eventName,
      timeUntilStart: eventDetails.timeUntilStart,
      startTime: eventDetails.startTime,
      eventUrl: eventDetails.url,
    });
  }

  /**
   * Send judging notification
   */
  async sendJudgingNotification(
    judgeEmail: string,
    eventName: string,
    judgingDetails: any
  ): Promise<void> {
    await this.sendFromTemplate(judgeEmail, 'judging-notification', {
      eventName,
      submissionCount: judgingDetails.submissionCount,
      deadline: judgingDetails.deadline,
      judgingUrl: judgingDetails.url,
    });
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    processing: boolean;
    byPriority: Record<string, number>;
  } {
    const byPriority = {
      high: 0,
      normal: 0,
      low: 0,
    };

    this.queue.forEach((item) => {
      byPriority[item.priority]++;
    });

    return {
      total: this.queue.length,
      pending: this.queue.length,
      processing: this.isProcessing,
      byPriority,
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Get available templates
   */
  getTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }
}

