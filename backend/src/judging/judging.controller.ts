import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JudgingService } from './judging.service';
import { ScoreSubmissionDto } from './dto/score-submission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('judging')
@Controller('events/:eventId/submissions/:submissionId')
export class JudgingController {
  constructor(private readonly judgingService: JudgingService) {}

  @Post('score')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Score/mark a submission (Judge or Host only)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({ name: 'submissionId', description: 'Submission ID' })
  @ApiResponse({ status: 200, description: 'Submission scored successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Judge role required' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async scoreSubmission(
    @Param('eventId') eventId: string,
    @Param('submissionId') submissionId: string,
    @Body() scoreDto: ScoreSubmissionDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const submission = await this.judgingService.scoreSubmission(
      eventId,
      submissionId,
      userAddress,
      scoreDto,
    );

    return {
      success: true,
      submission: {
        id: submission._id,
        status: submission.status,
        score: submission.score,
        participant: submission.participant,
      },
    };
  }
}

