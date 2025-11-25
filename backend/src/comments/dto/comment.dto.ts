import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsNotEmpty, IsOptional, IsMongoId, IsBoolean, IsEnum } from 'class-validator';

export enum CommentEntityType {
  EVENT = 'event',
  SUBMISSION = 'submission',
  USER = 'user',
  TEAM = 'team',
  ANNOUNCEMENT = 'announcement',
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Type of entity the comment is on', enum: CommentEntityType })
  @IsEnum(CommentEntityType)
  @IsNotEmpty()
  entityType: CommentEntityType;

  @ApiProperty({ description: 'ID of the entity the comment is on' })
  @IsMongoId()
  @IsNotEmpty()
  entityId: string;

  @ApiProperty({ description: 'Comment content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID (for replies)' })
  @IsOptional()
  @IsMongoId()
  parentCommentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ description: 'Updated comment content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ReplyCommentDto {
  @ApiProperty({ description: 'Reply content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CommentResponseDto {
  @ApiProperty({ description: 'Comment ID' })
  id: string;

  @ApiProperty({ description: 'Type of entity the comment is on', enum: CommentEntityType })
  entityType: CommentEntityType;

  @ApiProperty({ description: 'ID of the entity the comment is on' })
  entityId: string;

  @ApiProperty({ description: 'ID of the author' })
  authorId: string;

  @ApiProperty({ description: 'Comment content' })
  content: string;

  @ApiProperty({ description: 'Parent comment ID (for replies)' })
  parentCommentId?: string;

  @ApiProperty({ description: 'Array of user IDs who liked this comment' })
  likes: string[];

  @ApiProperty({ description: 'Count of likes' })
  likesCount: number;

  @ApiProperty({ description: 'Array of replies to this comment', type: [CommentResponseDto] })
  replies: CommentResponseDto[];

  @ApiProperty({ description: 'Whether the comment is pinned (highlighted)' })
  isPinned: boolean;

  @ApiProperty({ description: 'Whether the comment has been reported' })
  isReported: boolean;

  @ApiProperty({ description: 'Reason for reporting (if reported)' })
  reportReason?: string;

  @ApiProperty({ description: 'Whether the comment has been edited' })
  isEdited: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

