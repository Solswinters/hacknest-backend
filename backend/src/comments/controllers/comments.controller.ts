import {

  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CommentsService } from '../services/comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentFilterDto,
} from '../dto/comment.dto';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Create a new comment
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new comment' }}
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createComment(@Body() createCommentDto: CreateCommentDto, @Request() req) {
    try {
      this.logger.log(`Creating comment on ${createCommentDto.entityType}:${createCommentDto.entityId} by user ${req.user.userId}`);
      const comment = await this.commentsService.createComment({
        ...createCommentDto,
        userId: req.user.userId,
      });
      return {
        success: true,
        message: 'Comment created successfully',
        data: comment,
      };
    } catch (error) {
      this.logger.error('Failed to create comment:', error);
      throw new BadRequestException(error.message || 'Failed to create comment');
    }
  }

  /**
   * Get all comments with optional filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all comments' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getAllComments(@Query() filterDto: CommentFilterDto) {
    try {
      this.logger.log('Fetching all comments with filters');
      const { comments, total, page, limit } = await this.commentsService.getAllComments(filterDto);
      return {
        success: true,
        message: 'Comments retrieved successfully',
        data: comments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch comments:', error);
      throw new BadRequestException(error.message || 'Failed to fetch comments');
    }
  }

  /**
   * Get comment by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async getCommentById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching comment: ${id}`);
      const comment = await this.commentsService.getCommentById(id);
      if (!comment) {
        throw new NotFoundException(`Comment with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Comment retrieved successfully',
        data: comment,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch comment ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch comment');
    }
  }

  /**
   * Get comments by entity (e.g., submission, event)
   */
  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get comments by entity' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getCommentsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    try {
      this.logger.log(`Fetching comments for ${entityType}: ${entityId}`);
      const { comments, total } = await this.commentsService.getCommentsByEntity(
        entityType,
        entityId,
        page,
        limit,
        sortBy,
        sortOrder,
      );
      return {
        success: true,
        message: 'Comments retrieved successfully',
        data: comments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch comments for ${entityType} ${entityId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch comments');
    }
  }

  /**
   * Get comments by user ID
   */
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get comments by user ID' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  async getCommentsByUserId(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      this.logger.log(`Fetching comments by user: ${userId}`);
      const { comments, total } = await this.commentsService.getCommentsByUserId(userId, page, limit);
      return {
        success: true,
        message: 'Comments retrieved successfully',
        data: comments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch comments for user ${userId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch comments');
    }
  }

  /**
   * Get current user's comments
   */
  @Get('user/me/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s comments' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyComments(@Query('page') page = 1, @Query('limit') limit = 20, @Request() req) {
    try {
      this.logger.log(`Fetching comments for user: ${req.user.userId}`);
      const { comments, total } = await this.commentsService.getCommentsByUserId(req.user.userId, page, limit);
      return {
        success: true,
        message: 'Comments retrieved successfully',
        data: comments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch user comments:', error);
      throw new BadRequestException(error.message || 'Failed to fetch comments');
    }
  }

  /**
   * Get replies to a comment
   */
  @Get(':id/replies')
  @ApiOperation({ summary: 'Get replies to a comment' })
  @ApiResponse({ status: 200, description: 'Replies retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async getCommentReplies(
    @Param('id') commentId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    try {
      this.logger.log(`Fetching replies for comment: ${commentId}`);
      const { comments, total } = await this.commentsService.getCommentReplies(commentId, page, limit);
      return {
        success: true,
        message: 'Replies retrieved successfully',
        data: comments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch replies for comment ${commentId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch replies');
    }
  }

  /**
   * Update comment
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only comment author can update' })
  async updateComment(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Updating comment: ${id} by user ${req.user.userId}`);
      
      // Check if user is comment author
      const isAuthor = await this.commentsService.isCommentAuthor(id, req.user.userId);
      if (!isAuthor && !['admin'].includes(req.user.role)) {
        throw new ForbiddenException('Only comment author can update the comment');
      }

      const updatedComment = await this.commentsService.updateComment(id, updateCommentDto, req.user.userId);
      if (!updatedComment) {
        throw new NotFoundException(`Comment with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Comment updated successfully',
        data: updatedComment,
      };
    } catch (error) {
      this.logger.error(`Failed to update comment ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update comment');
    }
  }

  /**
   * Delete comment
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only comment author can delete' })
  async deleteComment(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting comment: ${id} by user ${req.user.userId}`);
      
      // Check if user is comment author or admin
      const isAuthor = await this.commentsService.isCommentAuthor(id, req.user.userId);
      if (!isAuthor && !['admin'].includes(req.user.role)) {
        throw new ForbiddenException('Only comment author can delete the comment');
      }

      const deleted = await this.commentsService.deleteComment(id, req.user.userId);
      if (!deleted) {
        throw new NotFoundException(`Comment with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Comment deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete comment ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete comment');
    }
  }

  /**
   * Like a comment
   */
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a comment' })
  @ApiResponse({ status: 200, description: 'Comment liked successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async likeComment(@Param('id') commentId: string, @Request() req) {
    try {
      this.logger.log(`User ${req.user.userId} liking comment ${commentId}`);
      const result = await this.commentsService.likeComment(commentId, req.user.userId);
      return {
        success: true,
        message: 'Comment liked successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to like comment ${commentId}:`, error);
      throw new BadRequestException(error.message || 'Failed to like comment');
    }
  }

  /**
   * Unlike a comment
   */
  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a comment' })
  @ApiResponse({ status: 200, description: 'Comment unliked successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unlikeComment(@Param('id') commentId: string, @Request() req) {
    try {
      this.logger.log(`User ${req.user.userId} unliking comment ${commentId}`);
      const result = await this.commentsService.unlikeComment(commentId, req.user.userId);
      return {
        success: true,
        message: 'Comment unliked successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to unlike comment ${commentId}:`, error);
      throw new BadRequestException(error.message || 'Failed to unlike comment');
    }
  }

  /**
   * Report a comment
   */
  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a comment' })
  @ApiResponse({ status: 200, description: 'Comment reported successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reportComment(
    @Param('id') commentId: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    try {
      this.logger.log(`User ${req.user.userId} reporting comment ${commentId}`);
      const result = await this.commentsService.reportComment(commentId, req.user.userId, body.reason);
      return {
        success: true,
        message: 'Comment reported successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to report comment ${commentId}:`, error);
      throw new BadRequestException(error.message || 'Failed to report comment');
    }
  }

  /**
   * Get comment statistics
   */
  @Get('stats/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get comment statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCommentStats(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    try {
      this.logger.log(`Fetching comment statistics${entityType ? ` for ${entityType}` : ''}${entityId ? `:${entityId}` : ''}`);
      const stats = await this.commentsService.getCommentStatistics(entityType, entityId);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch comment statistics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Pin a comment (moderators only)
   */
  @Post(':id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pin a comment (moderators only)' })
  @ApiResponse({ status: 200, description: 'Comment pinned successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async pinComment(@Param('id') commentId: string, @Request() req) {
    try {
      // Check if user has permission to pin comments
      if (!['admin', 'organizer'].includes(req.user.role)) {
        throw new ForbiddenException('Only moderators can pin comments');
      }

      this.logger.log(`Pinning comment ${commentId} by user ${req.user.userId}`);
      const comment = await this.commentsService.pinComment(commentId, req.user.userId);
      return {
        success: true,
        message: 'Comment pinned successfully',
        data: comment,
      };
    } catch (error) {
      this.logger.error(`Failed to pin comment ${commentId}:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to pin comment');
    }
  }

  /**
   * Unpin a comment (moderators only)
   */
  @Delete(':id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpin a comment (moderators only)' })
  @ApiResponse({ status: 200, description: 'Comment unpinned successfully' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async unpinComment(@Param('id') commentId: string, @Request() req) {
    try {
      // Check if user has permission to unpin comments
      if (!['admin', 'organizer'].includes(req.user.role)) {
        throw new ForbiddenException('Only moderators can unpin comments');
      }

      this.logger.log(`Unpinning comment ${commentId} by user ${req.user.userId}`);
      const comment = await this.commentsService.unpinComment(commentId, req.user.userId);
      return {
        success: true,
        message: 'Comment unpinned successfully',
        data: comment,
      };
    } catch (error) {
      this.logger.error(`Failed to unpin comment ${commentId}:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to unpin comment');
    }
  }
}

