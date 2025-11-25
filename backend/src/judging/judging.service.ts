import {

  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SubmissionsService } from '../submissions/submissions.service';
import { EventsService } from '../events/events.service';
import { PayoutService } from '../jobs/payout.service';
import { ScoreSubmissionDto } from './dto/score-submission.dto';
import { SubmissionStatus } from '../submissions/schemas/submission.schema';

interface JudgeScore {
  judgeAddress: string;
  score: number;
  timestamp: Date;
  comments?: string;
}

interface ScoringCriteria {
  innovation: number;
  technical: number;
  design: number;
  impact: number;
  presentation: number;
}

interface AggregatedScore {
  submissionId: string;
  averageScore: number;
  medianScore: number;
  normalizedScore: number;
  judgeScores: JudgeScore[];
  consensus: number;
  controversy: number;
}

interface JudgingAnalytics {
  totalSubmissions: number;
  scoredSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  standardDeviation: number;
  judgeActivity: Map<string, number>;
}

@Injectable()
export class JudgingService {
  private readonly logger = new Logger(JudgingService.name);
  private readonly judgeScores: Map<string, JudgeScore[]> = new Map();

  constructor(
    private submissionsService: SubmissionsService,
    private eventsService: EventsService,
    private payoutService: PayoutService,
  ) {}

  /**
   * Validate score
   */
  private validateScore(score: number): void {
    if (score < 0 || score > 100) {
      throw new BadRequestException('Score must be between 0 and 100');
    }
  }

  /**
   * Record judge score
   */
  private recordJudgeScore(
    submissionId: string,
    judgeAddress: string,
    score: number,
    comments?: string,
  ): void {
    const key = submissionId;
    const scores = this.judgeScores.get(key) || [];

    // Check if judge already scored this submission
    const existingIndex = scores.findIndex(
      (s) => s.judgeAddress === judgeAddress,
    );

    const newScore: JudgeScore = {
      judgeAddress,
      score,
      timestamp: new Date(),
      comments,
    };

    if (existingIndex >= 0) {
      scores[existingIndex] = newScore;
    } else {
      scores.push(newScore);
    }

    this.judgeScores.set(key, scores);
  }

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

    // Validate score if provided
    if (scoreDto.score !== undefined) {
      this.validateScore(scoreDto.score);
    }

    // Record judge score
    if (scoreDto.score !== undefined) {
      this.recordJudgeScore(
        submissionId,
        judgeAddress,
        scoreDto.score,
        scoreDto.comments,
      );
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

  /**
   * Calculate aggregated score for a submission
   */
  calculateAggregatedScore(submissionId: string): AggregatedScore | null {
    const scores = this.judgeScores.get(submissionId);

    if (!scores || scores.length === 0) {
      return null;
    }

    const scoreValues = scores.map((s) => s.score);

    // Calculate average
    const averageScore =
      scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;

    // Calculate median
    const sortedScores = [...scoreValues].sort((a, b) => a - b);
    const medianScore =
      sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1]! +
            sortedScores[sortedScores.length / 2]!) /
          2
        : sortedScores[Math.floor(sortedScores.length / 2)]!;

    // Calculate standard deviation (for controversy metric)
    const variance =
      scoreValues.reduce(
        (sum, score) => sum + Math.pow(score - averageScore, 2),
        0,
      ) / scoreValues.length;
    const stdDev = Math.sqrt(variance);

    // Consensus: inverse of coefficient of variation (lower std dev = higher consensus)
    const consensus =
      averageScore > 0 ? 100 - (stdDev / averageScore) * 100 : 0;

    // Controversy: based on standard deviation
    const controversy = Math.min(100, stdDev * 2);

    // Normalized score (weighted average with outliers removed)
    const normalizedScore = this.calculateNormalizedScore(scoreValues);

    return {
      submissionId,
      averageScore,
      medianScore,
      normalizedScore,
      judgeScores: scores,
      consensus: Math.max(0, consensus),
      controversy,
    };
  }

  /**
   * Calculate normalized score (remove outliers and weight remaining scores)
   */
  private calculateNormalizedScore(scores: number[]): number {
    if (scores.length < 3) {
      // Not enough scores to remove outliers
      return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // Calculate quartiles
    const sorted = [...scores].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
    const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
    const iqr = q3 - q1;

    // Remove outliers
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const filtered = scores.filter(
      (score) => score >= lowerBound && score <= upperBound,
    );

    if (filtered.length === 0) {
      return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    return filtered.reduce((sum, score) => sum + score, 0) / filtered.length;
  }

  /**
   * Get judging analytics for an event
   */
  async getJudgingAnalytics(eventId: string): Promise<JudgingAnalytics> {
    const submissions = await this.submissionsService.findByEvent(eventId);

    const scoredSubmissions = submissions.filter(
      (s) => s.score !== undefined && s.score !== null,
    );

    const scores = scoredSubmissions.map((s) => s.score as number);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    // Calculate standard deviation
    const variance =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) /
          scores.length
        : 0;
    const standardDeviation = Math.sqrt(variance);

    // Calculate judge activity
    const judgeActivity = new Map<string, number>();
    for (const [, judgeScores] of this.judgeScores) {
      for (const score of judgeScores) {
        const count = judgeActivity.get(score.judgeAddress) || 0;
        judgeActivity.set(score.judgeAddress, count + 1);
      }
    }

    return {
      totalSubmissions: submissions.length,
      scoredSubmissions: scoredSubmissions.length,
      averageScore,
      highestScore,
      lowestScore,
      standardDeviation,
      judgeActivity,
    };
  }

  /**
   * Get all scores for a submission
   */
  getSubmissionScores(submissionId: string): JudgeScore[] {
    return this.judgeScores.get(submissionId) || [];
  }

  /**
   * Check if judge has scored a submission
   */
  hasJudgeScored(submissionId: string, judgeAddress: string): boolean {
    const scores = this.judgeScores.get(submissionId) || [];
    return scores.some((s) => s.judgeAddress === judgeAddress);
  }

  /**
   * Get judge's score for a submission
   */
  getJudgeScore(
    submissionId: string,
    judgeAddress: string,
  ): JudgeScore | null {
    const scores = this.judgeScores.get(submissionId) || [];
    return scores.find((s) => s.judgeAddress === judgeAddress) || null;
  }

  /**
   * Calculate criteria-based score
   */
  calculateCriteriaScore(criteria: ScoringCriteria): number {
    const weights = {
      innovation: 0.25,
      technical: 0.25,
      design: 0.2,
      impact: 0.2,
      presentation: 0.1,
    };

    return (
      criteria.innovation * weights.innovation +
      criteria.technical * weights.technical +
      criteria.design * weights.design +
      criteria.impact * weights.impact +
      criteria.presentation * weights.presentation
    );
  }

  /**
   * Detect score manipulation or bias
   */
  detectScoringBias(submissionId: string): {
    hasBias: boolean;
    suspiciousJudges: string[];
    reason: string;
  } {
    const aggregated = this.calculateAggregatedScore(submissionId);

    if (!aggregated || aggregated.judgeScores.length < 3) {
      return {
        hasBias: false,
        suspiciousJudges: [],
        reason: 'Insufficient data',
      };
    }

    const suspiciousJudges: string[] = [];
    const avgScore = aggregated.averageScore;
    const threshold = 30; // 30 points deviation

    // Check for judges whose scores deviate significantly
    for (const score of aggregated.judgeScores) {
      if (Math.abs(score.score - avgScore) > threshold) {
        suspiciousJudges.push(score.judgeAddress);
      }
    }

    return {
      hasBias: suspiciousJudges.length > 0,
      suspiciousJudges,
      reason:
        suspiciousJudges.length > 0
          ? 'Significant deviation from average score detected'
          : 'No bias detected',
    };
  }

  /**
   * Rank submissions by normalized score
   */
  async rankSubmissions(eventId: string): Promise<
    Array<{
      submissionId: string;
      rank: number;
      score: number;
      consensus: number;
    }>
  > {
    const submissions = await this.submissionsService.findByEvent(eventId);

    const ranked = submissions
      .map((submission) => {
        const aggregated = this.calculateAggregatedScore(submission._id.toString());
        return {
          submissionId: submission._id.toString(),
          score: aggregated?.normalizedScore || submission.score || 0,
          consensus: aggregated?.consensus || 0,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return ranked;
  }

  /**
   * Clear scores (for testing or reset)
   */
  clearScores(submissionId?: string): void {
    if (submissionId) {
      this.judgeScores.delete(submissionId);
    } else {
      this.judgeScores.clear();
    }
  }
}

