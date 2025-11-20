import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sponsor, SponsorDocument } from '../schemas/sponsor.schema';

export interface CreateSponsorDto {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  description?: string;
  benefits?: string[];
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export interface UpdateSponsorDto {
  name?: string;
  logoUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  tier?: 'platinum' | 'gold' | 'silver' | 'bronze';
  description?: string;
  benefits?: string[];
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export interface SponsorStats {
  totalSponsors: number;
  activeSponsors: number;
  sponsorsByTier: Record<string, number>;
  totalEventsSponsored: number;
  topSponsors: Array<{ name: string; eventsCount: number }>;
}

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    @InjectModel(Sponsor.name) private sponsorModel: Model<SponsorDocument>,
  ) {}

  /**
   * Create a new sponsor
   */
  async create(createSponsorDto: CreateSponsorDto): Promise<SponsorDocument> {
    // Check if sponsor with same name exists
    const existing = await this.sponsorModel.findOne({
      name: createSponsorDto.name,
    });

    if (existing) {
      throw new BadRequestException('Sponsor with this name already exists');
    }

    const sponsor = new this.sponsorModel({
      ...createSponsorDto,
      isActive: true,
      eventsSponsored: [],
      totalContribution: 0,
      stats: {
        totalEvents: 0,
        totalPrizes: 0,
        averagePrizeAmount: 0,
        participantsReached: 0,
      },
    });

    const savedSponsor = await sponsor.save();
    this.logger.log(`Sponsor created: ${savedSponsor.name}`);
    
    return savedSponsor;
  }

  /**
   * Find sponsor by ID
   */
  async findById(sponsorId: string): Promise<SponsorDocument> {
    const sponsor = await this.sponsorModel.findById(sponsorId).exec();

    if (!sponsor) {
      throw new NotFoundException(`Sponsor with ID ${sponsorId} not found`);
    }

    return sponsor;
  }

  /**
   * Find all sponsors
   */
  async findAll(filters?: {
    isActive?: boolean;
    tier?: string;
  }): Promise<SponsorDocument[]> {
    const query: any = {};

    if (filters) {
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.tier) {
        query.tier = filters.tier;
      }
    }

    return this.sponsorModel.find(query).sort({ tier: 1, name: 1 }).exec();
  }

  /**
   * Update sponsor
   */
  async update(
    sponsorId: string,
    updateSponsorDto: UpdateSponsorDto,
  ): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    // Check if name is being changed and if it conflicts
    if (updateSponsorDto.name && updateSponsorDto.name !== sponsor.name) {
      const existing = await this.sponsorModel.findOne({
        name: updateSponsorDto.name,
        _id: { $ne: sponsorId },
      });

      if (existing) {
        throw new BadRequestException('Sponsor with this name already exists');
      }
    }

    Object.assign(sponsor, updateSponsorDto);
    
    const updatedSponsor = await sponsor.save();
    this.logger.log(`Sponsor updated: ${sponsorId}`);
    
    return updatedSponsor;
  }

  /**
   * Delete sponsor
   */
  async delete(sponsorId: string): Promise<void> {
    const sponsor = await this.findById(sponsorId);
    
    sponsor.isActive = false;
    await sponsor.save();
    
    this.logger.log(`Sponsor deactivated: ${sponsorId}`);
  }

  /**
   * Add event to sponsor
   */
  async addEvent(sponsorId: string, eventId: string): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    if (!sponsor.eventsSponsored.includes(eventId)) {
      sponsor.eventsSponsored.push(eventId);
      sponsor.stats.totalEvents = sponsor.eventsSponsored.length;
      
      const updatedSponsor = await sponsor.save();
      this.logger.log(`Event ${eventId} added to sponsor ${sponsorId}`);
      
      return updatedSponsor;
    }

    return sponsor;
  }

  /**
   * Remove event from sponsor
   */
  async removeEvent(sponsorId: string, eventId: string): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    sponsor.eventsSponsored = sponsor.eventsSponsored.filter(
      (id) => id !== eventId,
    );
    sponsor.stats.totalEvents = sponsor.eventsSponsored.length;
    
    const updatedSponsor = await sponsor.save();
    this.logger.log(`Event ${eventId} removed from sponsor ${sponsorId}`);
    
    return updatedSponsor;
  }

  /**
   * Get sponsors by event
   */
  async findByEvent(eventId: string): Promise<SponsorDocument[]> {
    return this.sponsorModel
      .find({
        eventsSponsored: eventId,
        isActive: true,
      })
      .exec();
  }

  /**
   * Update sponsor stats
   */
  async updateStats(
    sponsorId: string,
    stats: Partial<Sponsor['stats']>,
  ): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    sponsor.stats = {
      ...sponsor.stats,
      ...stats,
    };

    return sponsor.save();
  }

  /**
   * Add contribution
   */
  async addContribution(
    sponsorId: string,
    amount: number,
  ): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    sponsor.totalContribution += amount;
    sponsor.stats.totalPrizes += 1;
    
    // Recalculate average
    if (sponsor.stats.totalPrizes > 0) {
      sponsor.stats.averagePrizeAmount =
        sponsor.totalContribution / sponsor.stats.totalPrizes;
    }

    const updatedSponsor = await sponsor.save();
    this.logger.log(`Added contribution of ${amount} to sponsor ${sponsorId}`);
    
    return updatedSponsor;
  }

  /**
   * Get sponsor statistics
   */
  async getStats(): Promise<SponsorStats> {
    const sponsors = await this.sponsorModel.find().exec();

    const sponsorsByTier: Record<string, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };

    let totalEventsSponsored = 0;
    const activeSponsors = sponsors.filter((s) => s.isActive);

    sponsors.forEach((sponsor) => {
      if (sponsor.tier in sponsorsByTier) {
        sponsorsByTier[sponsor.tier] += 1;
      }
      totalEventsSponsored += sponsor.eventsSponsored.length;
    });

    const topSponsors = sponsors
      .sort((a, b) => b.eventsSponsored.length - a.eventsSponsored.length)
      .slice(0, 10)
      .map((sponsor) => ({
        name: sponsor.name,
        eventsCount: sponsor.eventsSponsored.length,
      }));

    return {
      totalSponsors: sponsors.length,
      activeSponsors: activeSponsors.length,
      sponsorsByTier,
      totalEventsSponsored,
      topSponsors,
    };
  }

  /**
   * Search sponsors
   */
  async search(query: string, limit: number = 10): Promise<SponsorDocument[]> {
    return this.sponsorModel
      .find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
        isActive: true,
      })
      .limit(limit)
      .exec();
  }

  /**
   * Get sponsors by tier
   */
  async findByTier(tier: string): Promise<SponsorDocument[]> {
    return this.sponsorModel
      .find({
        tier,
        isActive: true,
      })
      .sort({ name: 1 })
      .exec();
  }

  /**
   * Get top sponsors by contribution
   */
  async getTopSponsors(limit: number = 10): Promise<SponsorDocument[]> {
    return this.sponsorModel
      .find({ isActive: true })
      .sort({ totalContribution: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Verify sponsor ownership
   */
  async verifySponsor(sponsorId: string, email: string): Promise<boolean> {
    const sponsor = await this.findById(sponsorId);
    return sponsor.contactEmail.toLowerCase() === email.toLowerCase();
  }

  /**
   * Get sponsor engagement metrics
   */
  async getEngagementMetrics(sponsorId: string): Promise<{
    eventsSponsored: number;
    totalContribution: number;
    averageContribution: number;
    participantsReached: number;
    roi: number;
  }> {
    const sponsor = await this.findById(sponsorId);

    const averageContribution =
      sponsor.stats.totalPrizes > 0
        ? sponsor.totalContribution / sponsor.stats.totalPrizes
        : 0;

    // Calculate simple ROI based on participants reached
    const roi =
      sponsor.totalContribution > 0
        ? (sponsor.stats.participantsReached / sponsor.totalContribution) * 100
        : 0;

    return {
      eventsSponsored: sponsor.eventsSponsored.length,
      totalContribution: sponsor.totalContribution,
      averageContribution,
      participantsReached: sponsor.stats.participantsReached,
      roi,
    };
  }

  /**
   * Update participants reached
   */
  async updateParticipantsReached(
    sponsorId: string,
    count: number,
  ): Promise<SponsorDocument> {
    const sponsor = await this.findById(sponsorId);

    sponsor.stats.participantsReached += count;

    return sponsor.save();
  }

  /**
   * Get sponsors report
   */
  async generateReport(): Promise<{
    totalSponsors: number;
    activeSponsors: number;
    totalContribution: number;
    averageContributionPerSponsor: number;
    tierDistribution: Record<string, number>;
    topContributors: Array<{ name: string; contribution: number }>;
  }> {
    const sponsors = await this.sponsorModel.find().exec();
    const activeSponsors = sponsors.filter((s) => s.isActive);

    const totalContribution = sponsors.reduce(
      (sum, s) => sum + s.totalContribution,
      0,
    );

    const tierDistribution: Record<string, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };

    sponsors.forEach((sponsor) => {
      if (sponsor.tier in tierDistribution) {
        tierDistribution[sponsor.tier] += 1;
      }
    });

    const topContributors = sponsors
      .sort((a, b) => b.totalContribution - a.totalContribution)
      .slice(0, 10)
      .map((sponsor) => ({
        name: sponsor.name,
        contribution: sponsor.totalContribution,
      }));

    return {
      totalSponsors: sponsors.length,
      activeSponsors: activeSponsors.length,
      totalContribution,
      averageContributionPerSponsor:
        sponsors.length > 0 ? totalContribution / sponsors.length : 0,
      tierDistribution,
      topContributors,
    };
  }
}

