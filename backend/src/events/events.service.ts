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
}

