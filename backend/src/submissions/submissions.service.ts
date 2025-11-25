import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Submission, SubmissionDocument, SubmissionStatus } from './schemas/submission.schema';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { EventsService } from '../events/events.service';
import { verifySimpleSubmissionSignature } from './utils/verify-submission-signature';

interface SubmissionFilters {
  status?: SubmissionStatus;
  minScore?: number;
  maxScore?: number;
  participant?: string;
}

interface SubmissionStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  winner: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  // Validation constants
  private readonly MIN_PROJECT_TITLE_LENGTH = 3;
  private readonly MAX_PROJECT_TITLE_LENGTH = 100;
  private readonly MIN_DESCRIPTION_LENGTH = 10;
  private readonly MAX_DESCRIPTION_LENGTH = 5000;
  private readonly MAX_GITHUB_URL_LENGTH = 500;
  private readonly MAX_DEMO_URL_LENGTH = 500;

  constructor(
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
    private eventsService: EventsService,
  ) {}

  /**
   * Validate submission data
   */
  private validateSubmissionData(dto: CreateSubmissionDto): void {
    // Validate project title
    if (
      !dto.projectTitle ||
      dto.projectTitle.length < this.MIN_PROJECT_TITLE_LENGTH ||
      dto.projectTitle.length > this.MAX_PROJECT_TITLE_LENGTH
    ) {
      throw new BadRequestException(
        `Project title must be between ${this.MIN_PROJECT_TITLE_LENGTH} and ${this.MAX_PROJECT_TITLE_LENGTH} characters`,
      );
    }

    // Validate description
    if (
      !dto.description ||
      dto.description.length < this.MIN_DESCRIPTION_LENGTH ||
      dto.description.length > this.MAX_DESCRIPTION_LENGTH
    ) {
      throw new BadRequestException(
        `Description must be between ${this.MIN_DESCRIPTION_LENGTH} and ${this.MAX_DESCRIPTION_LENGTH} characters`,
      );
    }

    // Validate GitHub URL
    if (dto.githubUrl) {
      if (dto.githubUrl.length > this.MAX_GITHUB_URL_LENGTH) {
        throw new BadRequestException('GitHub URL is too long');
      }
      if (!this.isValidUrl(dto.githubUrl) || !dto.githubUrl.includes('github.com')) {
        throw new BadRequestException('Invalid GitHub URL');
      }
    }

    // Validate demo URL
    if (dto.demoUrl) {
      if (dto.demoUrl.length > this.MAX_DEMO_URL_LENGTH) {
        throw new BadRequestException('Demo URL is too long');
      }
      if (!this.isValidUrl(dto.demoUrl)) {
        throw new BadRequestException('Invalid demo URL');
      }
    }

    // Validate video URL if provided
    if (dto.videoUrl && !this.isValidUrl(dto.videoUrl)) {
      throw new BadRequestException('Invalid video URL');
    }
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new submission
   */
  async create(
    eventId: string,
    participantAddress: string,
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<SubmissionDocument> {
    // Validate submission data
    this.validateSubmissionData(createSubmissionDto);

    // Verify event exists and check dates
    const event = await this.eventsService.findById(eventId);
    const now = new Date();
    
    if (now < event.startDate) {
      throw new BadRequestException('Event has not started yet');
    }
    if (now > event.endDate) {
      throw new BadRequestException('Event has ended');
    }

    // Verify signature
    // const isValidSignature = verifySimpleSubmissionSignature(
    //   eventId,
    //   createSubmissionDto.signature,
    //   participantAddress,
    // );

    // if (!isValidSignature) {
    //   throw new BadRequestException('Invalid submission signature');
    // }

    // Check for duplicate submission
    const existingSubmission = await this.submissionModel.findOne({
      eventId: new Types.ObjectId(eventId),
      participant: participantAddress.toLowerCase(),
    });

    if (existingSubmission) {
      throw new BadRequestException('You have already submitted to this event');
    }

    const submission = new this.submissionModel({
      eventId: new Types.ObjectId(eventId),
      participant: participantAddress.toLowerCase(),
      ...createSubmissionDto,
    });

    const savedSubmission = await submission.save();
    this.logger.log(
      `Submission created: ${savedSubmission._id} for event ${eventId} by ${participantAddress}`,
    );

    return savedSubmission;
  }

  /**
   * Find submissions by event
   */
  async findByEvent(
    eventId: string,
    userAddress?: string,
    userRole?: string,
  ): Promise<SubmissionDocument[]> {
    // Verify event exists
    await this.eventsService.findById(eventId);

    const filter: any = { eventId: new Types.ObjectId(eventId) };

    // If not host/judge, only show winner submissions publicly
    const isHostOrJudge =
      userAddress &&
      ((await this.eventsService.isHost(eventId, userAddress)) ||
        (await this.eventsService.isJudge(eventId, userAddress)));

    if (!isHostOrJudge) {
      // Public view: only show winner submissions
      filter.status = SubmissionStatus.WINNER;
    }

    return this.submissionModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  /**
   * Find submission by ID
   */
  async findById(submissionId: string): Promise<SubmissionDocument> {
    const submission = await this.submissionModel.findById(submissionId).exec();

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    return submission;
  }

  /**
   * Update submission status (judging)
   */
  async updateStatus(
    submissionId: string,
    status: SubmissionStatus,
    score?: number,
  ): Promise<SubmissionDocument> {
    const submission = await this.findById(submissionId);

    submission.status = status;
    if (score !== undefined) {
      submission.score = score;
    }

    const updatedSubmission = await submission.save();
    this.logger.log(`Submission status updated: ${submissionId} -> ${status}`);

    return updatedSubmission;
  }

  /**
   * Find all submissions for a specific event and status
   */
  async findByEventAndStatus(
    eventId: string,
    status: SubmissionStatus,
  ): Promise<SubmissionDocument[]> {
    return this.submissionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        status,
      })
      .exec();
  }

  /**
   * Get winner submissions for an event
   */
  async getWinners(eventId: string): Promise<SubmissionDocument[]> {
    return this.findByEventAndStatus(eventId, SubmissionStatus.WINNER);
  }

  /**
   * Get submission statistics for an event
   */
  async getStatistics(eventId: string): Promise<SubmissionStatistics> {
    const submissions = await this.submissionModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .exec();

    const total = submissions.length;
    const pending = submissions.filter(
      (s) => s.status === SubmissionStatus.PENDING,
    ).length;
    const approved = submissions.filter(
      (s) => s.status === SubmissionStatus.APPROVED,
    ).length;
    const rejected = submissions.filter(
      (s) => s.status === SubmissionStatus.REJECTED,
    ).length;
    const winner = submissions.filter(
      (s) => s.status === SubmissionStatus.WINNER,
    ).length;

    const scores = submissions
      .filter((s) => s.score !== undefined && s.score !== null)
      .map((s) => s.score as number);

    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

    return {
      total,
      pending,
      approved,
      rejected,
      winner,
      averageScore,
      highestScore,
      lowestScore,
    };
  }

  /**
   * Filter submissions with advanced criteria
   */
  async filterSubmissions(
    eventId: string,
    filters: SubmissionFilters,
  ): Promise<SubmissionDocument[]> {
    const query: any = { eventId: new Types.ObjectId(eventId) };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.participant) {
      query.participant = filters.participant.toLowerCase();
    }

    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      query.score = {};
      if (filters.minScore !== undefined) {
        query.score.$gte = filters.minScore;
      }
      if (filters.maxScore !== undefined) {
        query.score.$lte = filters.maxScore;
      }
    }

    return this.submissionModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Get top submissions by score
   */
  async getTopSubmissions(
    eventId: string,
    limit: number = 10,
  ): Promise<SubmissionDocument[]> {
    return this.submissionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        score: { $exists: true, $ne: null },
      })
      .sort({ score: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get submission by participant
   */
  async getByParticipant(
    eventId: string,
    participantAddress: string,
  ): Promise<SubmissionDocument | null> {
    return this.submissionModel
      .findOne({
        eventId: new Types.ObjectId(eventId),
        participant: participantAddress.toLowerCase(),
      })
      .exec();
  }

  /**
   * Update submission details
   */
  async update(
    submissionId: string,
    participantAddress: string,
    updateDto: Partial<CreateSubmissionDto>,
  ): Promise<SubmissionDocument> {
    const submission = await this.findById(submissionId);

    // Verify ownership
    if (submission.participant !== participantAddress.toLowerCase()) {
      throw new ForbiddenException('You can only update your own submission');
    }

    // Verify submission is still pending
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Cannot update submission that has been judged');
    }

    // Validate updated data
    if (updateDto.projectTitle || updateDto.description) {
      this.validateSubmissionData({
        ...submission.toObject(),
        ...updateDto,
      } as CreateSubmissionDto);
    }

    // Update fields
    Object.assign(submission, updateDto);

    const updatedSubmission = await submission.save();
    this.logger.log(`Submission updated: ${submissionId}`);

    return updatedSubmission;
  }

  /**
   * Delete a submission
   */
  async delete(
    submissionId: string,
    participantAddress: string,
  ): Promise<void> {
    const submission = await this.findById(submissionId);

    // Verify ownership
    if (submission.participant !== participantAddress.toLowerCase()) {
      throw new ForbiddenException('You can only delete your own submission');
    }

    // Verify submission is still pending
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Cannot delete submission that has been judged');
    }

    await this.submissionModel.findByIdAndDelete(submissionId).exec();
    this.logger.log(`Submission deleted: ${submissionId}`);
  }

  /**
   * Bulk update submission status
   */
  async bulkUpdateStatus(
    submissionIds: string[],
    status: SubmissionStatus,
    score?: number,
  ): Promise<number> {
    const updateData: any = { status };
    if (score !== undefined) {
      updateData.score = score;
    }

    const result = await this.submissionModel
      .updateMany(
        { _id: { $in: submissionIds.map((id) => new Types.ObjectId(id)) } },
        { $set: updateData },
      )
      .exec();

    this.logger.log(
      `Bulk status update: ${result.modifiedCount} submissions updated to ${status}`,
    );

    return result.modifiedCount;
  }

  /**
   * Check if participant has submitted to an event
   */
  async hasSubmitted(eventId: string, participantAddress: string): Promise<boolean> {
    const submission = await this.getByParticipant(eventId, participantAddress);
    return submission !== null;
  }

  /**
   * Count submissions by status
   */
  async countByStatus(eventId: string, status: SubmissionStatus): Promise<number> {
    return this.submissionModel
      .countDocuments({
        eventId: new Types.ObjectId(eventId),
        status,
      })
      .exec();
  }

  /**
   * Get all submissions for a participant across all events
   */
  async getParticipantSubmissions(
    participantAddress: string,
  ): Promise<SubmissionDocument[]> {
    return this.submissionModel
      .find({ participant: participantAddress.toLowerCase() })
      .sort({ createdAt: -1 })
      .exec();
  }
}

