import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { InviteJudgesDto } from './dto/invite-judges.dto';
import { RemoveJudgeDto } from './dto/remove-judge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event (Host only)' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Host role required' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.create(createEventDto, userAddress);
    
    return {
      eventId: event._id,
      event: {
        id: event._id,
        title: event.title,
        host: event.host,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all events (Public)' })
  @ApiResponse({ status: 200, description: 'Events list returned' })
  async findAll(@Query() listEventsDto: ListEventsDto) {
    return this.eventsService.findAll(listEventsDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details (Public)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event details returned' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findById(id);
    
    return {
      id: event._id,
      host: event.host,
      title: event.title,
      description: event.description,
      rewardCurrency: event.rewardCurrency,
      rewardAmount: event.rewardAmount,
      contractAddress: event.contractAddress,
      startDate: event.startDate,
      endDate: event.endDate,
      judges: event.judges,
      status: event.status,
      createdAt: (event as any).createdAt,
    };
  }

  @Post(':id/judges/invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite/add judges to an event (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Judges invited successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can invite judges' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async inviteJudges(
    @Param('id') eventId: string,
    @Body() inviteJudgesDto: InviteJudgesDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.inviteJudges(
      eventId,
      inviteJudgesDto.judges,
      userAddress,
    );

    return {
      success: true,
      message: 'Judges invited successfully',
      event: {
        id: event._id,
        judges: event.judges,
      },
    };
  }

  @Delete(':id/judges')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a judge from an event (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Judge removed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can remove judges' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async removeJudge(
    @Param('id') eventId: string,
    @Body() removeJudgeDto: RemoveJudgeDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.removeJudge(
      eventId,
      removeJudgeDto.judgeAddress,
      userAddress,
    );

    return {
      success: true,
      message: 'Judge removed successfully',
      event: {
        id: event._id,
        judges: event.judges,
      },
    };
  }

  @Get(':id/judges')
  @ApiOperation({ summary: 'Get all judges for an event (Public)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Judges list returned' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getJudges(@Param('id') eventId: string) {
    const judges = await this.eventsService.getJudges(eventId);

    return {
      eventId,
      judges,
      count: judges.length,
    };
  }
}

