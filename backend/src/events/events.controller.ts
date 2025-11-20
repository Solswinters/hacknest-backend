import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event details (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can update' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(
    @Param('id') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.update(
      eventId,
      updateEventDto,
      userAddress,
    );

    return {
      success: true,
      message: 'Event updated successfully',
      event: {
        id: event._id,
        title: event.title,
        description: event.description,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate,
      },
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete/cancel an event (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can delete' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async delete(
    @Param('id') eventId: string,
    @CurrentUser('address') userAddress: string,
  ) {
    await this.eventsService.delete(eventId, userAddress);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get event statistics (Public)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event statistics returned' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getStatistics(@Param('id') eventId: string) {
    const stats = await this.eventsService.getEventStatistics(eventId);

    return {
      eventId,
      statistics: stats,
    };
  }

  @Get('filter/upcoming')
  @ApiOperation({ summary: 'Get upcoming events (Public)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of events to return',
  })
  @ApiResponse({ status: 200, description: 'Upcoming events returned' })
  async getUpcoming(@Query('limit') limit?: string) {
    const events = await this.eventsService.getUpcomingEvents(
      limit ? parseInt(limit, 10) : 10,
    );

    return {
      count: events.length,
      events,
    };
  }

  @Get('filter/past')
  @ApiOperation({ summary: 'Get past events (Public)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of events to return',
  })
  @ApiResponse({ status: 200, description: 'Past events returned' })
  async getPast(@Query('limit') limit?: string) {
    const events = await this.eventsService.getPastEvents(
      limit ? parseInt(limit, 10) : 10,
    );

    return {
      count: events.length,
      events,
    };
  }

  @Get('user/:userAddress')
  @ApiOperation({ summary: 'Get events by user (Public)' })
  @ApiParam({ name: 'userAddress', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'User events returned' })
  async getByUser(@Param('userAddress') userAddress: string) {
    const events = await this.eventsService.getEventsByUser(userAddress);

    return {
      userAddress,
      count: events.length,
      events,
    };
  }

  @Post(':id/participants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as participant (Authenticated)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Registered successfully' })
  @ApiResponse({ status: 400, description: 'Registration closed or invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async addParticipant(
    @Param('id') eventId: string,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.addParticipant(eventId, userAddress);

    return {
      success: true,
      message: 'Successfully registered as participant',
      event: {
        id: event._id,
        participantCount: event.participants?.length || 0,
      },
    };
  }

  @Delete(':id/participants/:participantAddress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove participant (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiParam({ name: 'participantAddress', description: 'Participant address' })
  @ApiResponse({ status: 200, description: 'Participant removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can remove' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async removeParticipant(
    @Param('id') eventId: string,
    @Param('participantAddress') participantAddress: string,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.removeParticipant(
      eventId,
      participantAddress,
      userAddress,
    );

    return {
      success: true,
      message: 'Participant removed successfully',
      event: {
        id: event._id,
        participantCount: event.participants?.length || 0,
      },
    };
  }

  @Get(':id/participants')
  @ApiOperation({ summary: 'Get all participants (Public)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Participants list returned' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getParticipants(@Param('id') eventId: string) {
    const participants = await this.eventsService.getParticipants(eventId);

    return {
      eventId,
      participants,
      count: participants.length,
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event status (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can update' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async updateStatus(
    @Param('id') eventId: string,
    @Body() body: { status: string },
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.updateStatus(
      eventId,
      body.status,
      userAddress,
    );

    return {
      success: true,
      message: 'Event status updated',
      event: {
        id: event._id,
        status: event.status,
      },
    };
  }

  @Post(':id/publish-results')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish event results (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Results published successfully' })
  @ApiResponse({ status: 400, description: 'Cannot publish results yet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can publish' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async publishResults(
    @Param('id') eventId: string,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.publishResults(eventId, userAddress);

    return {
      success: true,
      message: 'Results published successfully',
      event: {
        id: event._id,
        status: event.status,
      },
    };
  }

  @Post(':id/close-registration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HOST)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close event registration (Host only)' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Registration closed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only host can close' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async closeRegistration(
    @Param('id') eventId: string,
    @CurrentUser('address') userAddress: string,
  ) {
    const event = await this.eventsService.closeRegistration(
      eventId,
      userAddress,
    );

    return {
      success: true,
      message: 'Registration closed successfully',
      event: {
        id: event._id,
        registrationOpen: false,
      },
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search events (Public)' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results limit' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const events = await this.eventsService.searchEvents(
      query,
      limit ? parseInt(limit, 10) : 10,
    );

    return {
      query,
      count: events.length,
      events,
    };
  }
}

