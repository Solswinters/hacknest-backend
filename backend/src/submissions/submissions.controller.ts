import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('submissions')
@Controller('events/:eventId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit to an event (Participant)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or signature' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(
    @Param('eventId') eventId: string,
    @Body() createSubmissionDto: CreateSubmissionDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const submission = await this.submissionsService.create(
      eventId,
      userAddress,
      createSubmissionDto,
    );

    return {
      submissionId: submission._id,
      submission: {
        id: submission._id,
        eventId: submission.eventId,
        participant: submission.participant,
        title: submission.title,
        status: submission.status,
        createdAt: (submission as any).createdAt,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get submissions for an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Submissions list returned' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findAll(
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    try {
      const user = req.user; // May be undefined if not authenticated
      const submissions = await this.submissionsService.findByEvent(
        eventId,
        user?.address,
        user?.role,
      );

      return {
        submissions: submissions.map((s) => ({
          id: s._id,
          participant: s.participant,
          title: s.title,
          repo: s.repo,
          url: s.url,
          status: s.status,
          score: s.score,
          createdAt: (s as any).createdAt,
        })),
      };
    } catch (error) {
      // Let global filter handle it, or rethrow specific
      throw error;
    }
  }
}

