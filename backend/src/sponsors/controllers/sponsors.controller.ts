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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SponsorsService } from '../services/sponsors.service';
import { CreateSponsorDto, UpdateSponsorDto, SponsorFilterDto } from '../dto/sponsor.dto';

@ApiTags('Sponsors')
@Controller('sponsors')
export class SponsorsController {
  private readonly logger = new Logger(SponsorsController.name);

  constructor(private readonly sponsorsService: SponsorsService) {}

  /**
   * Create a new sponsor
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new sponsor' })
  @ApiResponse({ status: 201, description: 'Sponsor created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createSponsor(@Body() createSponsorDto: CreateSponsorDto, @Request() req) {
    try {
      this.logger.log(`Creating sponsor: ${createSponsorDto.name} by user ${req.user.userId}`);
      const sponsor = await this.sponsorsService.createSponsor(createSponsorDto, req.user.userId);
      return {
        success: true,
        message: 'Sponsor created successfully',
        data: sponsor,
      };
    } catch (error) {
      this.logger.error('Failed to create sponsor:', error);
      throw new BadRequestException(error.message || 'Failed to create sponsor');
    }
  }

  /**
   * Get all sponsors with optional filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all sponsors' })
  @ApiResponse({ status: 200, description: 'Sponsors retrieved successfully' })
  async getAllSponsors(@Query() filterDto: SponsorFilterDto) {
    try {
      this.logger.log('Fetching all sponsors with filters');
      const { sponsors, total, page, limit } = await this.sponsorsService.getAllSponsors(filterDto);
      return {
        success: true,
        message: 'Sponsors retrieved successfully',
        data: sponsors,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch sponsors:', error);
      throw new BadRequestException(error.message || 'Failed to fetch sponsors');
    }
  }

  /**
   * Get sponsor by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get sponsor by ID' })
  @ApiResponse({ status: 200, description: 'Sponsor retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  async getSponsorById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching sponsor: ${id}`);
      const sponsor = await this.sponsorsService.getSponsorById(id);
      if (!sponsor) {
        throw new NotFoundException(`Sponsor with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Sponsor retrieved successfully',
        data: sponsor,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch sponsor ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch sponsor');
    }
  }

  /**
   * Get sponsors by event ID
   */
  @Get('event/:eventId')
  @ApiOperation({ summary: 'Get sponsors by event ID' })
  @ApiResponse({ status: 200, description: 'Sponsors retrieved successfully' })
  async getSponsorsByEventId(@Param('eventId') eventId: string) {
    try {
      this.logger.log(`Fetching sponsors for event: ${eventId}`);
      const sponsors = await this.sponsorsService.getSponsorsByEventId(eventId);
      return {
        success: true,
        message: 'Sponsors retrieved successfully',
        data: sponsors,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch sponsors for event ${eventId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch sponsors');
    }
  }

  /**
   * Update sponsor
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor updated successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateSponsor(
    @Param('id') id: string,
    @Body() updateSponsorDto: UpdateSponsorDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Updating sponsor: ${id} by user ${req.user.userId}`);
      const updatedSponsor = await this.sponsorsService.updateSponsor(id, updateSponsorDto, req.user.userId);
      if (!updatedSponsor) {
        throw new NotFoundException(`Sponsor with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Sponsor updated successfully',
        data: updatedSponsor,
      };
    } catch (error) {
      this.logger.error(`Failed to update sponsor ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update sponsor');
    }
  }

  /**
   * Delete sponsor
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete sponsor' })
  @ApiResponse({ status: 204, description: 'Sponsor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteSponsor(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting sponsor: ${id} by user ${req.user.userId}`);
      const deleted = await this.sponsorsService.deleteSponsor(id, req.user.userId);
      if (!deleted) {
        throw new NotFoundException(`Sponsor with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Sponsor deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete sponsor ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete sponsor');
    }
  }

  /**
   * Get sponsor tiers
   */
  @Get('tiers/list')
  @ApiOperation({ summary: 'Get sponsor tiers' })
  @ApiResponse({ status: 200, description: 'Sponsor tiers retrieved successfully' })
  async getSponsorTiers() {
    try {
      this.logger.log('Fetching sponsor tiers');
      const tiers = await this.sponsorsService.getSponsorTiers();
      return {
        success: true,
        message: 'Sponsor tiers retrieved successfully',
        data: tiers,
      };
    } catch (error) {
      this.logger.error('Failed to fetch sponsor tiers:', error);
      throw new BadRequestException(error.message || 'Failed to fetch sponsor tiers');
    }
  }

  /**
   * Get sponsor statistics
   */
  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get sponsor statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSponsorStats(@Query('eventId') eventId?: string) {
    try {
      this.logger.log(`Fetching sponsor statistics${eventId ? ` for event ${eventId}` : ''}`);
      const stats = await this.sponsorsService.getSponsorStatistics(eventId);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error('Failed to fetch sponsor statistics:', error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Associate sponsor with an event
   */
  @Post(':id/events/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Associate sponsor with an event' })
  @ApiResponse({ status: 200, description: 'Sponsor associated successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor or event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async associateSponsorWithEvent(
    @Param('id') sponsorId: string,
    @Param('eventId') eventId: string,
    @Body() body: { tier?: string; contributionAmount?: number },
    @Request() req,
  ) {
    try {
      this.logger.log(
        `Associating sponsor ${sponsorId} with event ${eventId} by user ${req.user.userId}`,
      );
      const result = await this.sponsorsService.associateSponsorWithEvent(
        sponsorId,
        eventId,
        body.tier,
        body.contributionAmount,
        req.user.userId,
      );
      return {
        success: true,
        message: 'Sponsor associated with event successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to associate sponsor with event:`, error);
      throw new BadRequestException(error.message || 'Failed to associate sponsor with event');
    }
  }

  /**
   * Dissociate sponsor from an event
   */
  @Delete(':id/events/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dissociate sponsor from an event' })
  @ApiResponse({ status: 204, description: 'Sponsor dissociated successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor or event not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async dissociateSponsorFromEvent(
    @Param('id') sponsorId: string,
    @Param('eventId') eventId: string,
    @Request() req,
  ) {
    try {
      this.logger.log(
        `Dissociating sponsor ${sponsorId} from event ${eventId} by user ${req.user.userId}`,
      );
      await this.sponsorsService.dissociateSponsorFromEvent(sponsorId, eventId, req.user.userId);
      return {
        success: true,
        message: 'Sponsor dissociated from event successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to dissociate sponsor from event:`, error);
      throw new BadRequestException(error.message || 'Failed to dissociate sponsor from event');
    }
  }

  /**
   * Activate sponsor
   */
  @Put(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor activated successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async activateSponsor(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Activating sponsor: ${id} by user ${req.user.userId}`);
      const sponsor = await this.sponsorsService.updateSponsorStatus(id, 'active', req.user.userId);
      return {
        success: true,
        message: 'Sponsor activated successfully',
        data: sponsor,
      };
    } catch (error) {
      this.logger.error(`Failed to activate sponsor ${id}:`, error);
      throw new BadRequestException(error.message || 'Failed to activate sponsor');
    }
  }

  /**
   * Deactivate sponsor
   */
  @Put(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Sponsor not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deactivateSponsor(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deactivating sponsor: ${id} by user ${req.user.userId}`);
      const sponsor = await this.sponsorsService.updateSponsorStatus(id, 'inactive', req.user.userId);
      return {
        success: true,
        message: 'Sponsor deactivated successfully',
        data: sponsor,
      };
    } catch (error) {
      this.logger.error(`Failed to deactivate sponsor ${id}:`, error);
      throw new BadRequestException(error.message || 'Failed to deactivate sponsor');
    }
  }
}

