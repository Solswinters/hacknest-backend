import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

import { SubmissionStatus } from '../../submissions/schemas/submission.schema';

export class ScoreSubmissionDto {
  @ApiProperty({
    enum: [
      SubmissionStatus.ACCEPTED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.WINNER,
    ],
    example: SubmissionStatus.ACCEPTED,
  })
  @IsEnum([
    SubmissionStatus.ACCEPTED,
    SubmissionStatus.REJECTED,
    SubmissionStatus.WINNER,
  ])
  status: SubmissionStatus;

  @ApiPropertyOptional({
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}

