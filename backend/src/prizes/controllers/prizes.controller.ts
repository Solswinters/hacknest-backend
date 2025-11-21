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
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrizesService } from '../services/prizes.service';
import {
  CreatePrizeDto,
  UpdatePrizeDto,
  AwardPrizeDto,
  PrizeFilterDto,
} from '../dto/prize.dto';

@ApiTags('Prizes')
@Controller('prizes')
export class PrizesController {
  private readonly logger = new Logger(PrizesController.name);

  constructor(private readonly prizesService: PrizesService) {}

  /**
   * Create a new prize
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new prize' })
  @ApiResponse({ status: 201, description: 'Prize created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createPrize(@Body() createPrizeDto: CreatePrizeDto, @Request() req) {
    try {
      this.logger.log(`Creating prize: ${createPrizeDto.name} by user ${req.user.userId}`);
      const prize = await this.prizesService.createPrize(createPrizeDto, req.user.userId);
      return {
        success: true,
        message: 'Prize created successfully',
        data: prize,
      };
    } catch (error) {
      this.logger.error('Failed to create prize:', error);
      throw new BadRequestException(error.message || 'Failed to create prize');
    }
  }

  /**
   * Get all prizes with optional filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all prizes' })
  @ApiResponse({ status: 200, description: 'Prizes retrieved successfully' })
  async getAllPrizes(@Query() filterDto: PrizeFilterDto) {
    try {
      this.logger.log('Fetching all prizes with filters');
      const { prizes, total, page, limit } = await this.prizesService.getAllPrizes(filterDto);
      return {
        success: true,
        message: 'Prizes retrieved successfully',
        data: prizes,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch prizes:', error);
      throw new BadRequestException(error.message || 'Failed to fetch prizes');
    }
  }

  /**
   * Get prize by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get prize by ID' })
  @ApiResponse({ status: 200, description: 'Prize retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  async getPrizeById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching prize: ${id}`);
      const prize = await this.prizesService.getPrizeById(id);
      if (!prize) {
        throw new NotFoundException(`Prize with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Prize retrieved successfully',
        data: prize,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch prize ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch prize');
    }
  }

  /**
   * Get prizes by event ID
   */
  @Get('event/:eventId')
  @ApiOperation({ summary: 'Get prizes by event ID' })
  @ApiResponse({ status: 200, description: 'Prizes retrieved successfully' })
  async getPrizesByEventId(@Param('eventId') eventId: string) {
    try {
      this.logger.log(`Fetching prizes for event: ${eventId}`);
      const prizes = await this.prizesService.getPrizesByEventId(eventId);
      return {
        success: true,
        message: 'Prizes retrieved successfully',
        data: prizes,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch prizes for event ${eventId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch prizes');
    }
  }

  /**
   * Update prize
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update prize' })
  @ApiResponse({ status: 200, description: 'Prize updated successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updatePrize(
    @Param('id') id: string,
    @Body() updatePrizeDto: UpdatePrizeDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Updating prize: ${id} by user ${req.user.userId}`);
      const updatedPrize = await this.prizesService.updatePrize(id, updatePrizeDto, req.user.userId);
      if (!updatedPrize) {
        throw new NotFoundException(`Prize with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Prize updated successfully',
        data: updatedPrize,
      };
    } catch (error) {
      this.logger.error(`Failed to update prize ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update prize');
    }
  }

  /**
   * Delete prize
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete prize' })
  @ApiResponse({ status: 204, description: 'Prize deleted successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deletePrize(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting prize: ${id} by user ${req.user.userId}`);
      const deleted = await this.prizesService.deletePrize(id, req.user.userId);
      if (!deleted) {
        throw new NotFoundException(`Prize with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Prize deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete prize ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete prize');
    }
  }

  /**
   * Award prize to a submission
   */
  @Post(':id/award')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer', 'judge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Award prize to a submission' })
  @ApiResponse({ status: 200, description: 'Prize awarded successfully' })
  @ApiResponse({ status: 404, description: 'Prize or submission not found' })
  @ApiResponse({ status: 400, description: 'Prize already awarded or invalid submission' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async awardPrize(
    @Param('id') prizeId: string,
    @Body() awardPrizeDto: AwardPrizeDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Awarding prize ${prizeId} to submission ${awardPrizeDto.submissionId} by user ${req.user.userId}`);
      const result = await this.prizesService.awardPrize(prizeId, awardPrizeDto, req.user.userId);
      return {
        success: true,
        message: 'Prize awarded successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to award prize ${prizeId}:`, error);
      throw new BadRequestException(error.message || 'Failed to award prize');
    }
  }

  /**
   * Revoke prize award
   */
  @Delete(':id/award')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke prize award' })
  @ApiResponse({ status: 204, description: 'Prize award revoked successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  @ApiResponse({ status: 400, description: 'Prize not awarded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async revokePrizeAward(@Param('id') prizeId: string, @Request() req) {
    try {
      this.logger.log(`Revoking prize award for ${prizeId} by user ${req.user.userId}`);
      await this.prizesService.revokePrizeAward(prizeId, req.user.userId);
      return {
        success: true,
        message: 'Prize award revoked successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to revoke prize award ${prizeId}:`, error);
      throw new BadRequestException(error.message || 'Failed to revoke prize award');
    }
  }

  /**
   * Get awarded prizes
   */
  @Get('awarded/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get awarded prizes' })
  @ApiResponse({ status: 200, description: 'Awarded prizes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAwardedPrizes(@Query('eventId') eventId?: string) {
    try {
      this.logger.log(`Fetching awarded prizes${eventId ? ` for event ${eventId}` : ''}`);
      const prizes = await this.prizesService.getAwardedPrizes(eventId);
      return {
        success: true,
        message: 'Awarded prizes retrieved successfully',
        data: prizes,
      };
    } catch (error) {
      this.logger.error('Failed to fetch awarded prizes:', error);
      throw new BadRequestException(error.message || 'Failed to fetch awarded prizes');
    }
  }

  /**
   * Get prize statistics
   */
  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get prize statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPrizeStats(@Query('eventId') eventId?: string) {
    try {
      this.logger.log(`Fetching prize statistics${eventId ? ` for event ${eventId}` : ''}`);
      const stats = await this.prizesService.getPrizeStatistics(eventId);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch prize statistics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Get prize pool total for an event
   */
  @Get('event/:eventId/total')
  @ApiOperation({ summary: 'Get prize pool total for an event' })
  @ApiResponse({ status: 200, description: 'Prize pool total retrieved successfully' })
  async getPrizePoolTotal(@Param('eventId') eventId: string) {
    try {
      this.logger.log(`Fetching prize pool total for event: ${eventId}`);
      const total = await this.prizesService.getPrizePoolTotal(eventId);
      return {
        success: true,
        message: 'Prize pool total retrieved successfully',
        data: {
          eventId,
          totalPrizePool: total.totalAmount,
          awardedAmount: total.awardedAmount,
          remainingAmount: total.remainingAmount,
          prizeCount: total.prizeCount,
          awardedCount: total.awardedCount,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch prize pool total for event ${eventId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch prize pool total');
    }
  }

  /**
   * Initiate payout for awarded prize
   */
  @Post(':id/payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payout for awarded prize' })
  @ApiResponse({ status: 200, description: 'Payout initiated successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  @ApiResponse({ status: 400, description: 'Prize not awarded or already paid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async initiatePayout(@Param('id') prizeId: string, @Request() req) {
    try {
      this.logger.log(`Initiating payout for prize ${prizeId} by user ${req.user.userId}`);
      const result = await this.prizesService.initiatePayout(prizeId, req.user.userId);
      return {
        success: true,
        message: 'Payout initiated successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate payout for prize ${prizeId}:`, error);
      throw new BadRequestException(error.message || 'Failed to initiate payout');
    }
  }

  /**
   * Get payout status for prize
   */
  @Get(':id/payout/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payout status for prize' })
  @ApiResponse({ status: 200, description: 'Payout status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Prize not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPayoutStatus(@Param('id') prizeId: string) {
    try {
      this.logger.log(`Fetching payout status for prize: ${prizeId}`);
      const status = await this.prizesService.getPayoutStatus(prizeId);
      return {
        success: true,
        message: 'Payout status retrieved successfully',
        data: status,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch payout status for prize ${prizeId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch payout status');
    }
  }

  /**
   * Get prizes won by a user
   */
  @Get('user/:userId/won')
  @ApiOperation({ summary: 'Get prizes won by a user' })
  @ApiResponse({ status: 200, description: 'Prizes retrieved successfully' })
  async getPrizesWonByUser(@Param('userId') userId: string) {
    try {
      this.logger.log(`Fetching prizes won by user: ${userId}`);
      const prizes = await this.prizesService.getPrizesWonByUser(userId);
      return {
        success: true,
        message: 'Prizes retrieved successfully',
        data: prizes,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch prizes for user ${userId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch prizes');
    }
  }

  /**
   * Get my prizes (current user)
   */
  @Get('user/my-prizes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s prizes' })
  @ApiResponse({ status: 200, description: 'Prizes retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyPrizes(@Request() req) {
    try {
      this.logger.log(`Fetching prizes for user: ${req.user.userId}`);
      const prizes = await this.prizesService.getPrizesWonByUser(req.user.userId);
      return {
        success: true,
        message: 'Prizes retrieved successfully',
        data: prizes,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user prizes:', error);
      throw new BadRequestException(error.message || 'Failed to fetch prizes');
    }
  }
}

