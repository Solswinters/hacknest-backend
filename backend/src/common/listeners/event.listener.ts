import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

export interface EventPayload {
  eventId: string;
  eventName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SubmissionPayload {
  submissionId: string;
  eventId: string;
  participantId: string;
  status: string;
  timestamp: Date;
}

export interface PayoutPayload {
  payoutId: string;
  eventId: string;
  winnerId: string;
  amount: number;
  currency: string;
  status: string;
  timestamp: Date;
}

@Injectable()
export class EventListener {
  private readonly logger = new Logger(EventListener.name);

  /**
   * Event created
   */
  @OnEvent('event.created')
  handleEventCreated(payload: EventPayload): void {
    this.logger.log(`Event created: ${payload.eventName} (${payload.eventId})`);

    // Send notifications to interested parties
    // Track analytics
    // Update cache
  }

  /**
   * Event updated
   */
  @OnEvent('event.updated')
  handleEventUpdated(payload: EventPayload): void {
    this.logger.log(`Event updated: ${payload.eventName} (${payload.eventId})`);

    // Notify participants
    // Update cache
  }

  /**
   * Event started
   */
  @OnEvent('event.started')
  handleEventStarted(payload: EventPayload): void {
    this.logger.log(`Event started: ${payload.eventName} (${payload.eventId})`);

    // Send start notifications
    // Enable submission collection
    // Start monitoring
  }

  /**
   * Event ended
   */
  @OnEvent('event.ended')
  handleEventEnded(payload: EventPayload): void {
    this.logger.log(`Event ended: ${payload.eventName} (${payload.eventId})`);

    // Close submissions
    // Trigger judging
    // Archive event data
  }

  /**
   * Submission created
   */
  @OnEvent('submission.created')
  handleSubmissionCreated(payload: SubmissionPayload): void {
    this.logger.log(`Submission created: ${payload.submissionId} for event ${payload.eventId}`);

    // Notify organizers
    // Update submission count
    // Track analytics
  }

  /**
   * Submission updated
   */
  @OnEvent('submission.updated')
  handleSubmissionUpdated(payload: SubmissionPayload): void {
    this.logger.log(`Submission updated: ${payload.submissionId}`);

    // Notify relevant parties
    // Update cache
  }

  /**
   * Submission approved
   */
  @OnEvent('submission.approved')
  handleSubmissionApproved(payload: SubmissionPayload): void {
    this.logger.log(`Submission approved: ${payload.submissionId}`);

    // Notify participant
    // Update leaderboard
    // Trigger next workflow step
  }

  /**
   * Submission rejected
   */
  @OnEvent('submission.rejected')
  handleSubmissionRejected(payload: SubmissionPayload): void {
    this.logger.log(`Submission rejected: ${payload.submissionId}`);

    // Notify participant with reason
    // Update statistics
  }

  /**
   * Judging started
   */
  @OnEvent('judging.started')
  handleJudgingStarted(payload: EventPayload): void {
    this.logger.log(`Judging started for event: ${payload.eventId}`);

    // Notify judges
    // Lock submissions
    // Initialize judging dashboard
  }

  /**
   * Judging completed
   */
  @OnEvent('judging.completed')
  handleJudgingCompleted(payload: EventPayload): void {
    this.logger.log(`Judging completed for event: ${payload.eventId}`);

    // Calculate final results
    // Prepare winner announcements
    // Trigger payout process
  }

  /**
   * Score submitted
   */
  @OnEvent('score.submitted')
  handleScoreSubmitted(payload: {
    judgeId: string;
    submissionId: string;
    score: number;
  }): void {
    this.logger.log(`Score submitted by judge ${payload.judgeId} for submission ${payload.submissionId}`);

    // Update aggregated score
    // Check if all judges completed
    // Notify organizers
  }

  /**
   * Prize created
   */
  @OnEvent('prize.created')
  handlePrizeCreated(payload: {
    prizeId: string;
    eventId: string;
    amount: number;
  }): void {
    this.logger.log(`Prize created for event ${payload.eventId}: ${payload.amount}`);

    // Notify participants
    // Update prize pool
    // Track analytics
  }

  /**
   * Prize awarded
   */
  @OnEvent('prize.awarded')
  handlePrizeAwarded(payload: PayoutPayload): void {
    this.logger.log(`Prize awarded to ${payload.winnerId}: ${payload.amount} ${payload.currency}`);

    // Send congratulations notification
    // Update winner profile
    // Track payout status
  }

  /**
   * Prize paid
   */
  @OnEvent('prize.paid')
  handlePrizePaid(payload: PayoutPayload): void {
    this.logger.log(`Prize paid successfully: ${payload.payoutId}`);

    // Confirm transaction
    // Send receipt
    // Update records
  }

  /**
   * Team created
   */
  @OnEvent('team.created')
  handleTeamCreated(payload: {
    teamId: string;
    eventId: string;
    leaderId: string;
  }): void {
    this.logger.log(`Team created: ${payload.teamId} for event ${payload.eventId}`);

    // Notify event organizers
    // Update team statistics
  }

  /**
   * Team member joined
   */
  @OnEvent('member.joined')
  handleMemberJoined(payload: {
    teamId: string;
    userId: string;
    role: string;
  }): void {
    this.logger.log(`User ${payload.userId} joined team ${payload.teamId}`);

    // Notify team members
    // Update team roster
  }

  /**
   * Team member left
   */
  @OnEvent('member.left')
  handleMemberLeft(payload: {
    teamId: string;
    userId: string;
  }): void {
    this.logger.log(`User ${payload.userId} left team ${payload.teamId}`);

    // Notify team leader
    // Update team roster
  }

  /**
   * User registered
   */
  @OnEvent('user.registered')
  handleUserRegistered(payload: {
    userId: string;
    walletAddress: string;
  }): void {
    this.logger.log(`User registered: ${payload.userId}`);

    // Send welcome email
    // Initialize user profile
    // Track registration analytics
  }

  /**
   * Sponsor added
   */
  @OnEvent('sponsor.added')
  handleSponsorAdded(payload: {
    sponsorId: string;
    eventId: string;
    tier: string;
  }): void {
    this.logger.log(`Sponsor added to event ${payload.eventId}: ${payload.sponsorId}`);

    // Update sponsor section
    // Send thank you communication
    // Track sponsor engagement
  }

  /**
   * Error occurred
   */
  @OnEvent('error.occurred')
  handleError(payload: {
    error: Error;
    context: string;
    userId?: string;
  }): void {
    this.logger.error(`Error in ${payload.context}: ${payload.error.message}`, payload.error.stack);

    // Send error report
    // Trigger alerts if critical
    // Log for debugging
  }

  /**
   * System health check
   */
  @OnEvent('system.health_check')
  handleHealthCheck(payload: {
    status: string;
    timestamp: Date;
  }): void {
    this.logger.debug(`System health check: ${payload.status}`);

    // Monitor system status
    // Alert if unhealthy
  }
}

export default EventListener;

