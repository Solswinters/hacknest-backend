import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { Model } from 'mongoose';

import { CreateSponsorDto, UpdateSponsorDto, SponsorResponseDto } from '../dto/sponsor.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Sponsor, SponsorDocument } from '../schemas/sponsor.schema';

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    @InjectModel(Sponsor.name)
    private sponsorModel: Model<SponsorDocument>,
  ) {}

  /**
   * Create a new sponsor
   */
  async createSponsor(createSponsorDto: CreateSponsorDto): Promise<SponsorResponseDto> {
    this.logger.log(`Creating sponsor: ${createSponsorDto.name}`);

    const sponsor = new this.sponsorModel({
      ...createSponsorDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await sponsor.save();
    return this.mapToResponseDto(saved);
  }

  /**
   * Find all sponsors with pagination and filtering
   */
  async findAllSponsors(
    paginationDto: PaginationDto,
    search?: string,
    eventId?: string,
  ): Promise<{ data: SponsorResponseDto[]; total: number }> {
    const { page = 0, limit = 10 } = paginationDto;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
      ];
    }

    if (eventId) {
      query.eventIds = eventId;
    }

    const [sponsors, total] = await Promise.all([
      this.sponsorModel
        .find(query)
        .skip(page * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.sponsorModel.countDocuments(query).exec(),
    ]);

    return {
      data: sponsors.map((sponsor) => this.mapToResponseDto(sponsor)),
      total,
    };
  }

  /**
   * Find a sponsor by ID
   */
  async findSponsorById(id: string): Promise<SponsorResponseDto> {
    const sponsor = await this.sponsorModel.findById(id).exec();

    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID ${id} not found`);
    }

    return this.mapToResponseDto(sponsor);
  }

  /**
   * Update a sponsor
   */
  async updateSponsor(id: string, updateSponsorDto: UpdateSponsorDto): Promise<SponsorResponseDto> {
    this.logger.log(`Updating sponsor: ${id}`);

    const sponsor = await this.sponsorModel.findById(id).exec();

    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID ${id} not found`);
    }

    Object.assign(sponsor, updateSponsorDto);
    sponsor.updatedAt = new Date();

    const updated = await sponsor.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Delete a sponsor
   */
  async deleteSponsor(id: string): Promise<void> {
    this.logger.log(`Deleting sponsor: ${id}`);

    const result = await this.sponsorModel.deleteOne({ _id: id }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Sponsor with ID ${id} not found`);
    }
  }

  /**
   * Associate an event with a sponsor
   */
  async addEventToSponsor(sponsorId: string, eventId: string): Promise<SponsorResponseDto> {
    this.logger.log(`Adding event ${eventId} to sponsor ${sponsorId}`);

    const sponsor = await this.sponsorModel.findById(sponsorId).exec();

    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID ${sponsorId} not found`);
    }

    if (!sponsor.eventIds) {
      sponsor.eventIds = [];
    }

    if (!sponsor.eventIds.includes(eventId)) {
      sponsor.eventIds.push(eventId);
      sponsor.updatedAt = new Date();
      await sponsor.save();
    }

    return this.mapToResponseDto(sponsor);
  }

  /**
   * Remove an event association from a sponsor
   */
  async removeEventFromSponsor(sponsorId: string, eventId: string): Promise<SponsorResponseDto> {
    this.logger.log(`Removing event ${eventId} from sponsor ${sponsorId}`);

    const sponsor = await this.sponsorModel.findById(sponsorId).exec();

    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID ${sponsorId} not found`);
    }

    if (sponsor.eventIds) {
      sponsor.eventIds = sponsor.eventIds.filter((id) => id !== eventId);
      sponsor.updatedAt = new Date();
      await sponsor.save();
    }

    return this.mapToResponseDto(sponsor);
  }

  /**
   * Get sponsors for a specific event
   */
  async getSponsorsForEvent(eventId: string): Promise<SponsorResponseDto[]> {
    const sponsors = await this.sponsorModel.find({ eventIds: eventId }).exec();
    return sponsors.map((sponsor) => this.mapToResponseDto(sponsor));
  }

  /**
   * Get sponsorship statistics
   */
  async getStatistics(): Promise<{
    totalSponsors: number;
    totalAmount: number;
    byTier: Record<string, number>;
  }> {
    const sponsors = await this.sponsorModel.find().exec();

    const totalSponsors = sponsors.length;
    const totalAmount = sponsors.reduce((sum, sponsor) => sum + (sponsor.amount || 0), 0);

    const byTier: Record<string, number> = {};
    sponsors.forEach((sponsor) => {
      const tier = sponsor.tier || 'unspecified';
      byTier[tier] = (byTier[tier] || 0) + 1;
    });

    return {
      totalSponsors,
      totalAmount,
      byTier,
    };
  }

  /**
   * Map sponsor document to response DTO
   */
  private mapToResponseDto(sponsor: SponsorDocument): SponsorResponseDto {
    return {
      id: sponsor._id.toString(),
      name: sponsor.name,
      description: sponsor.description,
      logoUrl: sponsor.logoUrl,
      websiteUrl: sponsor.websiteUrl,
      contactEmail: sponsor.contactEmail,
      contactPhone: sponsor.contactPhone,
      contactName: sponsor.contactName,
      tier: sponsor.tier,
      amount: sponsor.amount,
      eventIds: sponsor.eventIds || [],
      metadata: sponsor.metadata,
      createdAt: sponsor.createdAt,
      updatedAt: sponsor.updatedAt,
    };
  }
}
