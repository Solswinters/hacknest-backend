import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SubmissionsService } from '../submissions/submissions.service';
import { EventsService } from '../events/events.service';
import { PayoutService } from '../jobs/payout.service';
import { ScoreSubmissionDto } from './dto/score-submission.dto';
import { SubmissionStatus } from '../submissions/schemas/submission.schema';

@Injectable()
export class JudgingService {
  private readonly logger = new Logger(JudgingService.name);

  constructor(
    private submissionsService: SubmissionsService,
    private eventsService: EventsService,
    private payoutService: PayoutService,
  ) {}

  /**
   * Score/mark a submission
   */
  async scoreSubmission(
    eventId: string,
    submissionId: string,
    judgeAddress: string,
    scoreDto: ScoreSubmissionDto,
  ) {
    // Verify judge is authorized for this event
    const isJudge = await this.eventsService.isJudge(eventId, judgeAddress);
    const isHost = await this.eventsService.isHost(eventId, judgeAddress);

    if (!isJudge && !isHost) {
      throw new ForbiddenException(
        'Only judges or event host can score submissions',
      );
    }

    // Get submission and verify it belongs to the event
    const submission = await this.submissionsService.findById(submissionId);
    
    if (submission.eventId.toString() !== eventId) {
      throw new NotFoundException('Submission not found in this event');
    }

    // Update submission status and score
    const updatedSubmission = await this.submissionsService.updateStatus(
      submissionId,
      scoreDto.status,
      scoreDto.score,
    );

    this.logger.log(
      `Submission ${submissionId} scored by ${judgeAddress}: ${scoreDto.status}`,
    );

    // If marked as winner, enqueue payout job
    if (scoreDto.status === SubmissionStatus.WINNER) {
      await this.enqueuePayoutForWinner(eventId, judgeAddress);
    }

    return updatedSubmission;
  }

  /**
   * Enqueue payout job when winners are selected
   */
  private async enqueuePayoutForWinner(eventId: string, initiatedBy: string) {
    // Get all winners for the event
    const winners = await this.submissionsService.getWinners(eventId);
    
    if (winners.length === 0) {
      this.logger.warn(`No winners found for event ${eventId}`);
      return;
    }

    // Get event details for reward info
    const event = await this.eventsService.findById(eventId);

    // Calculate amount per winner (equal distribution for MVP)
    const totalAmount = BigInt(event.rewardAmount);
    const amountPerWinner = totalAmount / BigInt(winners.length);

    // Prepare winner payout data
    const winnerPayouts = winners.map((winner) => ({
      address: winner.participant,
      amount: amountPerWinner.toString(),
    }));

    // Enqueue payout job
    await this.payoutService.enqueuePayout(
      eventId,
      winnerPayouts,
      initiatedBy,
    );

    this.logger.log(
      `Payout job enqueued for event ${eventId} with ${winners.length} winner(s)`,
    );
  }
}

