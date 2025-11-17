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

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectModel(Submission.name)
    private submissionModel: Model<SubmissionDocument>,
    private eventsService: EventsService,
  ) {}

  /**
   * Create a new submission
   */
  async create(
    eventId: string,
    participantAddress: string,
    createSubmissionDto: CreateSubmissionDto,
  ): Promise<SubmissionDocument> {
    // Verify event exists
    const event = await this.eventsService.findById(eventId);

    // Check if event is still accepting submissions
    const now = new Date();
    if (now < event.startDate) {
      throw new BadRequestException('Event has not started yet');
    }
    if (now > event.endDate) {
      throw new BadRequestException('Event has ended');
    }

    // Verify signature
    const isValidSignature = verifySimpleSubmissionSignature(
      eventId,
      createSubmissionDto.signature,
      participantAddress,
    );

    if (!isValidSignature) {
      throw new BadRequestException('Invalid submission signature');
    }

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
}

