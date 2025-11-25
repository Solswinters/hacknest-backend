import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

import * as SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Default sender address
  replyTo?: string; // Default reply-to address
}

export interface MailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string; // File path or URL
  contentType?: string;
  encoding?: string;
  cid?: string; // Content-ID for inline images
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: MailAttachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
}

export interface MailStatus {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
  envelope: {
    from: string;
    to: string[];
  };
}

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  requiredVariables: string[];
  description?: string;
}

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private config: MailConfig;
  private templates: Map<string, MailTemplate> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private mailQueue: Array<{
    options: SendMailOptions;
    resolve: (value: MailStatus) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = this.loadMailConfig();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeTransporter();
      await this.verifyConnection();
      this.logger.log('Mail service initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize mail service:', error);
      this.scheduleReconnect();
    }
  }

  onModuleDestroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
    this.logger.log('Mail service shut down.');
  }

  /**
   * Load mail configuration from environment variables.
   */
  private loadMailConfig(): MailConfig {
    return {
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: this.configService.get<boolean>('MAIL_SECURE', false),
      auth: {
        user: this.configService.get<string>('MAIL_USER', ''),
        pass: this.configService.get<string>('MAIL_PASSWORD', ''),
      },
      from: this.configService.get<string>('MAIL_FROM', 'noreply@hacknest.io'),
      replyTo: this.configService.get<string>('MAIL_REPLY_TO'),
    };
  }

  /**
   * Initialize the mail transporter.
   */
  private async initializeTransporter(): Promise<void> {
    if (!this.config.auth.user || !this.config.auth.pass) {
      this.logger.warn('Mail credentials not configured. Emails will be queued but not sent.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
    } as SMTPTransport.Options);

    this.logger.debug(`Mail transporter initialized: ${this.config.host}:${this.config.port}`);
  }

  /**
   * Verify the connection to the mail server.
   */
  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('Mail transporter not initialized.');
    }

    try {
      await this.transporter.verify();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('Mail server connection verified.');
      this.eventEmitter.emit('mail.connected');
      this.processMailQueue(); // Process any queued emails
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Mail server connection failed: ${error.message}`);
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached. Mail service unavailable.');
      this.eventEmitter.emit('mail.connectionFailed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000); // Exponential backoff, max 60s
    this.reconnectAttempts++;

    this.logger.warn(`Reconnecting to mail server in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.initializeTransporter();
        await this.verifyConnection();
      } catch (error) {
        this.logger.error('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Send an email.
   * @param options Mail options.
   * @returns A promise that resolves with the mail status.
   */
  public async sendMail(options: SendMailOptions): Promise<MailStatus> {
    if (!this.isConnected || !this.transporter) {
      this.logger.warn('Mail server not connected. Queuing email...');
      return this.queueMail(options);
    }

    try {
      const mailOptions = {
        from: options.from || this.config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo || this.config.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        headers: options.headers,
        priority: options.priority,
      };

      const info = await this.transporter.sendMail(mailOptions);

      const status: MailStatus = {
        messageId: info.messageId,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
        response: info.response,
        envelope: {
          from: info.envelope.from,
          to: info.envelope.to as string[],
        },
      };

      this.logger.log(`Email sent successfully: ${status.messageId} to ${options.to}`);
      this.eventEmitter.emit('mail.sent', status);

      return status;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      this.eventEmitter.emit('mail.error', error);
      throw error;
    }
  }

  /**
   * Queue an email for later sending when connection is restored.
   */
  private queueMail(options: SendMailOptions): Promise<MailStatus> {
    return new Promise((resolve, reject) => {
      this.mailQueue.push({ options, resolve, reject });
      this.logger.debug(`Email queued. Queue length: ${this.mailQueue.length}`);
      this.eventEmitter.emit('mail.queued', options);
    });
  }

  /**
   * Process queued emails.
   */
  private async processMailQueue(): Promise<void> {
    if (this.isProcessingQueue || this.mailQueue.length === 0 || !this.isConnected) {
      return;
    }

    this.isProcessingQueue = true;
    this.logger.log(`Processing mail queue: ${this.mailQueue.length} emails...`);

    while (this.mailQueue.length > 0 && this.isConnected) {
      const { options, resolve, reject } = this.mailQueue.shift()!;

      try {
        const status = await this.sendMail(options);
        resolve(status);
      } catch (error) {
        reject(error);
      }

      // Small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
    this.logger.log('Mail queue processed.');
  }

  /**
   * Register a mail template.
   */
  public registerTemplate(template: MailTemplate): void {
    if (this.templates.has(template.id)) {
      this.logger.warn(`Mail template '${template.id}' already exists. Overwriting.`);
    }
    this.templates.set(template.id, template);
    this.logger.debug(`Mail template '${template.id}' registered.`);
    this.eventEmitter.emit('mail.templateRegistered', template.id);
  }

  /**
   * Get a registered mail template.
   */
  public getTemplate(templateId: string): MailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all registered templates.
   */
  public getAllTemplates(): MailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Send email using a template.
   * @param templateId The ID of the template.
   * @param to Recipient email address(es).
   * @param variables Variables to replace in the template.
   * @param options Additional mail options.
   * @returns A promise that resolves with the mail status.
   */
  public async sendFromTemplate(
    templateId: string,
    to: string | string[],
    variables: Record<string, any>,
    options?: Partial<SendMailOptions>,
  ): Promise<MailStatus> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Mail template '${templateId}' not found.`);
    }

    // Validate required variables
    const missingVars = template.requiredVariables.filter((variable) => !(variable in variables));
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables for template '${templateId}': ${missingVars.join(', ')}`);
    }

    // Replace variables in the template
    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.html, variables);
    const text = template.text ? this.replaceVariables(template.text, variables) : undefined;

    return this.sendMail({
      to,
      subject,
      html,
      text,
      ...options,
    });
  }

  /**
   * Replace variables in a string template.
   * Supports {{variableName}} syntax.
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return variables[variable] !== undefined ? String(variables[variable]) : match;
    });
  }

  /**
   * Send a batch of emails.
   * @param emails Array of mail options.
   * @returns An array of mail statuses.
   */
  public async sendBatch(emails: SendMailOptions[]): Promise<MailStatus[]> {
    this.logger.log(`Sending batch of ${emails.length} emails...`);
    const results: MailStatus[] = [];

    for (const email of emails) {
      try {
        const status = await this.sendMail(email);
        results.push(status);
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`Failed to send email in batch: ${error.message}`);
        // Continue with next email
      }
    }

    this.logger.log(`Batch send completed: ${results.length}/${emails.length} successful.`);
    return results;
  }

  /**
   * Test the mail configuration by sending a test email.
   */
  public async testConnection(recipient?: string): Promise<boolean> {
    try {
      await this.verifyConnection();

      if (recipient) {
        await this.sendMail({
          to: recipient,
          subject: 'HackNest Mail Service Test',
          text: 'This is a test email from HackNest mail service.',
          html: '<p>This is a <strong>test email</strong> from HackNest mail service.</p>',
        });
        this.logger.log(`Test email sent to ${recipient}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Mail connection test failed:', error);
      return false;
    }
  }

  /**
   * Get mail service status.
   */
  public getStatus(): {
    connected: boolean;
    host: string;
    port: number;
    queueLength: number;
    reconnectAttempts: number;
    templatesCount: number;
  } {
    return {
      connected: this.isConnected,
      host: this.config.host,
      port: this.config.port,
      queueLength: this.mailQueue.length,
      reconnectAttempts: this.reconnectAttempts,
      templatesCount: this.templates.size,
    };
  }

  /**
   * Clear the mail queue.
   */
  public clearQueue(): void {
    const rejectionError = new Error('Mail queue cleared');
    this.mailQueue.forEach(({ reject }) => reject(rejectionError));
    this.mailQueue = [];
    this.logger.log('Mail queue cleared.');
    this.eventEmitter.emit('mail.queueCleared');
  }

  /**
   * Update mail configuration at runtime.
   */
  public async updateConfig(newConfig: Partial<MailConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Mail configuration updated. Reinitializing transporter...');

    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }

    await this.initializeTransporter();
    await this.verifyConnection();
  }

  /**
   * Event listeners
   */
  public onMailSent(listener: (status: MailStatus) => void): void {
    this.eventEmitter.on('mail.sent', listener);
  }

  public onMailError(listener: (error: Error) => void): void {
    this.eventEmitter.on('mail.error', listener);
  }

  public onMailQueued(listener: (options: SendMailOptions) => void): void {
    this.eventEmitter.on('mail.queued', listener);
  }

  public onMailConnected(listener: () => void): void {
    this.eventEmitter.on('mail.connected', listener);
  }

  public onMailConnectionFailed(listener: () => void): void {
    this.eventEmitter.on('mail.connectionFailed', listener);
  }
}
