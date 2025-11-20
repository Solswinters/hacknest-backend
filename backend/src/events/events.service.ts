import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument, EventStatus } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  /**
   * Create a new event
   */
  async create(createEventDto: CreateEventDto, hostAddress: string): Promise<EventDocument> {
    const event = new this.eventModel({
      ...createEventDto,
      host: hostAddress.toLowerCase(),
      judges: createEventDto.judges.map((j) => j.toLowerCase()),
      startDate: new Date(createEventDto.startDate),
      endDate: new Date(createEventDto.endDate),
    });

    const savedEvent = await event.save();
    this.logger.log(`Event created: ${savedEvent._id} by ${hostAddress}`);
    
    return savedEvent;
  }

  /**
   * Find all events with pagination and filters
   */
  async findAll(listEventsDto: ListEventsDto) {
    const { page = 1, limit = 10, status } = listEventsDto;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const [events, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find event by ID
   */
  async findById(id: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  /**
   * Update event (only by host)
   */
  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    userAddress: string,
  ): Promise<EventDocument> {
    const event = await this.findById(id);

    if (event.host !== userAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can update this event');
    }

    Object.assign(event, updateEventDto);
    
    if (updateEventDto.judges) {
      event.judges = updateEventDto.judges.map((j) => j.toLowerCase());
    }

    const updatedEvent = await event.save();
    this.logger.log(`Event updated: ${id} by ${userAddress}`);
    
    return updatedEvent;
  }

  /**
   * Update event status
   */
  async updateStatus(id: string, status: EventStatus, userAddress: string): Promise<EventDocument> {
    const event = await this.findById(id);

    if (event.host !== userAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can update event status');
    }

    event.status = status;
    const updatedEvent = await event.save();
    
    this.logger.log(`Event status updated: ${id} -> ${status}`);
    return updatedEvent;
  }

  /**
   * Check if user is a judge for the event
   */
  async isJudge(eventId: string, userAddress: string): Promise<boolean> {
    const event = await this.findById(eventId);
    return event.judges.includes(userAddress.toLowerCase());
  }

  /**
   * Check if user is the host of the event
   */
  async isHost(eventId: string, userAddress: string): Promise<boolean> {
    const event = await this.findById(eventId);
    return event.host === userAddress.toLowerCase();
  }

  /**
   * Invite/add judges to an event (only by host)
   */
  async inviteJudges(
    eventId: string,
    judgeAddresses: string[],
    hostAddress: string,
  ): Promise<EventDocument> {
    const event = await this.findById(eventId);

    // Verify the user is the host
    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can invite judges');
    }

    // Normalize addresses and filter out duplicates
    const normalizedAddresses = judgeAddresses.map((addr) => addr.toLowerCase());
    const existingJudges = new Set(event.judges);
    const newJudges = normalizedAddresses.filter((addr) => !existingJudges.has(addr));

    if (newJudges.length === 0) {
      this.logger.warn(`No new judges to add to event ${eventId}`);
      return event;
    }

    // Add new judges to the event
    event.judges = [...event.judges, ...newJudges];
    const updatedEvent = await event.save();

    this.logger.log(
      `Added ${newJudges.length} judge(s) to event ${eventId}: ${newJudges.join(', ')}`,
    );

    return updatedEvent;
  }

  /**
   * Remove a judge from an event (only by host)
   */
  async removeJudge(
    eventId: string,
    judgeAddress: string,
    hostAddress: string,
  ): Promise<EventDocument> {
    const event = await this.findById(eventId);

    // Verify the user is the host
    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can remove judges');
    }

    const normalizedJudgeAddress = judgeAddress.toLowerCase();
    const initialLength = event.judges.length;

    // Remove the judge
    event.judges = event.judges.filter((addr) => addr !== normalizedJudgeAddress);

    if (event.judges.length === initialLength) {
      this.logger.warn(
        `Judge ${normalizedJudgeAddress} not found in event ${eventId}`,
      );
      return event;
    }

    const updatedEvent = await event.save();
    this.logger.log(`Removed judge ${normalizedJudgeAddress} from event ${eventId}`);

    return updatedEvent;
  }

  /**
   * Get all judges for an event
   */
  async getJudges(eventId: string): Promise<string[]> {
    const event = await this.findById(eventId);
    return event.judges;
  }

  /**
   * Find events hosted by a specific address
   */
  async findByHost(hostAddress: string, page = 1, limit = 10): Promise<{
    events: EventDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const normalizedAddress = hostAddress.toLowerCase();
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.eventModel
        .find({ host: normalizedAddress })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments({ host: normalizedAddress }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find events where user is a judge
   */
  async findByJudge(judgeAddress: string, page = 1, limit = 10): Promise<{
    events: EventDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const normalizedAddress = judgeAddress.toLowerCase();
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.eventModel
        .find({ judges: normalizedAddress })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments({ judges: normalizedAddress }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get event statistics
   */
  async getEventStats(eventId: string): Promise<{
    totalSubmissions: number;
    totalJudges: number;
    isActive: boolean;
    daysRemaining: number;
  }> {
    const event = await this.findById(eventId);
    const now = new Date();
    const endDate = new Date(event.endDate);
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      totalSubmissions: 0, // Would need to query submissions collection
      totalJudges: event.judges.length,
      isActive: event.status === EventStatus.ACTIVE,
      daysRemaining,
    };
  }

  /**
   * Find active events
   */
  async findActiveEvents(page = 1, limit = 10): Promise<{
    events: EventDocument[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.eventModel
        .find({ status: EventStatus.ACTIVE })
        .sort({ endDate: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments({ status: EventStatus.ACTIVE }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete an event (only by host)
   */
  async delete(eventId: string, hostAddress: string): Promise<void> {
    const event = await this.findById(eventId);

    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can delete this event');
    }

    await this.eventModel.deleteOne({ _id: eventId });
    this.logger.log(`Event deleted: ${eventId} by ${hostAddress}`);
  }

  /**
   * Check if event is active and open for submissions
   */
  async isOpenForSubmissions(eventId: string): Promise<boolean> {
    const event = await this.findById(eventId);
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    return (
      event.status === EventStatus.ACTIVE &&
      now >= startDate &&
      now <= endDate
    );
  }

  /**
   * Get total count of events
   */
  async getTotalCount(): Promise<number> {
    return this.eventModel.countDocuments();
  }

  /**
   * Find upcoming events
   */
  async findUpcoming(limit = 10): Promise<EventDocument[]> {
    const now = new Date();

    return this.eventModel
      .find({
        status: EventStatus.ACTIVE,
        startDate: { $gt: now },
      })
      .sort({ startDate: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Find recently ended events
   */
  async findRecentlyEnded(limit = 10): Promise<EventDocument[]> {
    return this.eventModel
      .find({
        status: { $in: [EventStatus.COMPLETED, EventStatus.CANCELLED] },
      })
      .sort({ endDate: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(eventId: string) {
    return this.getEventStats(eventId);
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10): Promise<EventDocument[]> {
    return this.findUpcoming(limit);
  }

  /**
   * Get past events
   */
  async getPastEvents(limit = 10): Promise<EventDocument[]> {
    return this.findRecentlyEnded(limit);
  }

  /**
   * Get events by user (hosted or judging)
   */
  async getEventsByUser(userAddress: string): Promise<EventDocument[]> {
    const normalizedAddress = userAddress.toLowerCase();
    
    const events = await this.eventModel
      .find({
        $or: [
          { host: normalizedAddress },
          { judges: normalizedAddress },
          { participants: normalizedAddress },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();

    return events;
  }

  /**
   * Add participant to event
   */
  async addParticipant(eventId: string, participantAddress: string): Promise<EventDocument> {
    const event = await this.findById(eventId);
    const normalizedAddress = participantAddress.toLowerCase();

    // Initialize participants array if it doesn't exist
    if (!event.participants) {
      event.participants = [];
    }

    // Check if already registered
    if (event.participants.includes(normalizedAddress)) {
      this.logger.warn(`Participant ${normalizedAddress} already registered for event ${eventId}`);
      return event;
    }

    // Check if registration is open
    const now = new Date();
    if (event.status !== EventStatus.ACTIVE || now > new Date(event.endDate)) {
      throw new ForbiddenException('Registration is closed for this event');
    }

    event.participants.push(normalizedAddress);
    const updatedEvent = await event.save();
    
    this.logger.log(`Added participant ${normalizedAddress} to event ${eventId}`);
    return updatedEvent;
  }

  /**
   * Remove participant from event
   */
  async removeParticipant(
    eventId: string,
    participantAddress: string,
    hostAddress: string,
  ): Promise<EventDocument> {
    const event = await this.findById(eventId);

    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can remove participants');
    }

    const normalizedAddress = participantAddress.toLowerCase();
    
    if (!event.participants) {
      event.participants = [];
    }

    const initialLength = event.participants.length;
    event.participants = event.participants.filter((addr) => addr !== normalizedAddress);

    if (event.participants.length === initialLength) {
      this.logger.warn(`Participant ${normalizedAddress} not found in event ${eventId}`);
      return event;
    }

    const updatedEvent = await event.save();
    this.logger.log(`Removed participant ${normalizedAddress} from event ${eventId}`);
    
    return updatedEvent;
  }

  /**
   * Get all participants for an event
   */
  async getParticipants(eventId: string): Promise<string[]> {
    const event = await this.findById(eventId);
    return event.participants || [];
  }

  /**
   * Publish event results
   */
  async publishResults(eventId: string, hostAddress: string): Promise<EventDocument> {
    const event = await this.findById(eventId);

    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can publish results');
    }

    if (event.status !== EventStatus.ACTIVE) {
      throw new ForbiddenException('Event must be active to publish results');
    }

    event.status = EventStatus.COMPLETED;
    const updatedEvent = await event.save();
    
    this.logger.log(`Published results for event ${eventId}`);
    return updatedEvent;
  }

  /**
   * Close registration for event
   */
  async closeRegistration(eventId: string, hostAddress: string): Promise<EventDocument> {
    const event = await this.findById(eventId);

    if (event.host !== hostAddress.toLowerCase()) {
      throw new ForbiddenException('Only the event host can close registration');
    }

    // Add registrationOpen field to event schema if needed
    (event as any).registrationOpen = false;
    
    const updatedEvent = await event.save();
    this.logger.log(`Closed registration for event ${eventId}`);
    
    return updatedEvent;
  }

  /**
   * Search events by title or description
   */
  async searchEvents(query: string, limit = 10): Promise<EventDocument[]> {
    const searchRegex = new RegExp(query, 'i');
    
    const events = await this.eventModel
      .find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return events;
  }
}

