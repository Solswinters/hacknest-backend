import { Injectable, Logger } from '@nestjs/common';

export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromAddress: string = process.env.MAIL_FROM || 'noreply@hacknest.io';

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // In production, integrate with actual email service (SendGrid, AWS SES, etc.)
      this.logger.log(`Sending email to ${options.to}`);
      this.logger.debug(`Subject: ${options.subject}`);

      // Simulate sending
      await this.simulateSend();

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, username: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Welcome to HackNest!',
      html: this.getWelcomeTemplate(username),
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    to: string,
    token: string
  ): Promise<boolean> {
    const verificationLink = `${process.env.APP_URL}/verify?token=${token}`;

    return this.sendEmail({
      to,
      subject: 'Verify your email',
      html: this.getVerificationTemplate(verificationLink),
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    token: string
  ): Promise<boolean> {
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;

    return this.sendEmail({
      to,
      subject: 'Reset your password',
      html: this.getPasswordResetTemplate(resetLink),
    });
  }

  /**
   * Send event notification
   */
  async sendEventNotification(
    to: string,
    eventName: string,
    eventDate: Date
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `Event Reminder: ${eventName}`,
      html: this.getEventNotificationTemplate(eventName, eventDate),
    });
  }

  /**
   * Send submission confirmation
   */
  async sendSubmissionConfirmation(
    to: string,
    eventName: string
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Submission Received',
      html: this.getSubmissionConfirmationTemplate(eventName),
    });
  }

  /**
   * Send winner notification
   */
  async sendWinnerNotification(
    to: string,
    eventName: string,
    prize: string
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Congratulations! You Won!',
      html: this.getWinnerNotificationTemplate(eventName, prize),
    });
  }

  /**
   * Simulate email sending
   */
  private async simulateSend(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  /**
   * Get welcome email template
   */
  private getWelcomeTemplate(username: string): string {
    return `
      <h1>Welcome to HackNest, ${username}!</h1>
      <p>We're excited to have you on board.</p>
      <p>Start exploring hackathons and building amazing projects!</p>
    `;
  }

  /**
   * Get verification email template
   */
  private getVerificationTemplate(link: string): string {
    return `
      <h1>Verify Your Email</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${link}">Verify Email</a>
    `;
  }

  /**
   * Get password reset template
   */
  private getPasswordResetTemplate(link: string): string {
    return `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${link}">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
    `;
  }

  /**
   * Get event notification template
   */
  private getEventNotificationTemplate(
    eventName: string,
    eventDate: Date
  ): string {
    return `
      <h1>Event Reminder</h1>
      <p>Don't forget about ${eventName}!</p>
      <p>Date: ${eventDate.toLocaleDateString()}</p>
    `;
  }

  /**
   * Get submission confirmation template
   */
  private getSubmissionConfirmationTemplate(eventName: string): string {
    return `
      <h1>Submission Received</h1>
      <p>Your submission for ${eventName} has been received.</p>
      <p>Good luck!</p>
    `;
  }

  /**
   * Get winner notification template
   */
  private getWinnerNotificationTemplate(
    eventName: string,
    prize: string
  ): string {
    return `
      <h1>Congratulations!</h1>
      <p>You won ${prize} for ${eventName}!</p>
      <p>We'll contact you soon with more details.</p>
    `;
  }
}

export default MailService;

