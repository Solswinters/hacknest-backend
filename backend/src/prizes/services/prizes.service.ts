import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prize, PrizeDocument } from '../schemas/prize.schema';

export interface CreatePrizeDto {
  eventId: string;
  title: string;
  description?: string;
  amount: number;
  currency: 'USD' | 'ETH' | 'USDC' | 'CUSTOM';
  tokenAddress?: string;
  category?: string;
  rank?: number;
  eligibilityCriteria?: string[];
  sponsorId?: string;
}

export interface UpdatePrizeDto {
  title?: string;
  description?: string;
  amount?: number;
  currency?: 'USD' | 'ETH' | 'USDC' | 'CUSTOM';
  category?: string;
  rank?: number;
  eligibilityCriteria?: string[];
}

export interface PrizeStats {
  totalPrizes: number;
  totalValue: number;
  prizesByStatus: Record<string, number>;
  prizesByCategory: Record<string, number>;
  averagePrizeAmount: number;
}

export interface PrizeDistribution {
  eventId: string;
  totalAmount: number;
  prizeCount: number;
  winners: Array<{
    prizeId: string;
    winner: string;
    amount: number;
    status: string;
  }>;
}

@Injectable()
export class PrizesService {
  private readonly logger = new Logger(PrizesService.name);

  constructor(
    @InjectModel(Prize.name) private prizeModel: Model<PrizeDocument>,
  ) {}

  /**
   * Create a new prize
   */
  async create(createPrizeDto: CreatePrizeDto): Promise<PrizeDocument> {
    const prize = new this.prizeModel({
      ...createPrizeDto,
      status: 'pending',
      metadata: {
        views: 0,
        applicants: 0,
        claimAttempts: 0,
      },
    });

    const savedPrize = await prize.save();
    this.logger.log(`Prize created: ${savedPrize._id} for event ${createPrizeDto.eventId}`);

    return savedPrize;
  }

  /**
   * Find prize by ID
   */
  async findById(prizeId: string): Promise<PrizeDocument> {
    const prize = await this.prizeModel.findById(prizeId).exec();

    if (!prize) {
      throw new NotFoundException(`Prize with ID ${prizeId} not found`);
    }

    return prize;
  }

  /**
   * Find all prizes
   */
  async findAll(filters?: {
    eventId?: string;
    status?: string;
    category?: string;
    sponsorId?: string;
  }): Promise<PrizeDocument[]> {
    const query: any = {};

    if (filters) {
      if (filters.eventId) {
        query.eventId = filters.eventId;
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.sponsorId) {
        query.sponsorId = filters.sponsorId;
      }
    }

    return this.prizeModel.find(query).sort({ rank: 1, amount: -1 }).exec();
  }

  /**
   * Update prize
   */
  async update(prizeId: string, updatePrizeDto: UpdatePrizeDto): Promise<PrizeDocument> {
    const prize = await this.findById(prizeId);

    // Cannot update awarded prizes
    if (prize.status === 'awarded') {
      throw new BadRequestException('Cannot update an awarded prize');
    }

    Object.assign(prize, updatePrizeDto);

    const updatedPrize = await prize.save();
    this.logger.log(`Prize updated: ${prizeId}`);

    return updatedPrize;
  }

  /**
   * Delete prize
   */
  async delete(prizeId: string): Promise<void> {
    const prize = await this.findById(prizeId);

    // Cannot delete awarded prizes
    if (prize.status === 'awarded') {
      throw new BadRequestException('Cannot delete an awarded prize');
    }

    prize.status = 'cancelled';
    await prize.save();

    this.logger.log(`Prize cancelled: ${prizeId}`);
  }

  /**
   * Award prize to winner
   */
  async award(
    prizeId: string,
    winnerId: string,
    submissionId?: string,
  ): Promise<PrizeDocument> {
    const prize = await this.findById(prizeId);

    if (prize.status === 'awarded') {
      throw new BadRequestException('Prize has already been awarded');
    }

    prize.winner = winnerId;
    prize.submissionId = submissionId;
    prize.status = 'awarded';
    prize.awardedAt = new Date();

    const updatedPrize = await prize.save();
    this.logger.log(`Prize ${prizeId} awarded to ${winnerId}`);

    return updatedPrize;
  }

  /**
   * Mark prize as paid
   */
  async markAsPaid(prizeId: string, transactionHash?: string): Promise<PrizeDocument> {
    const prize = await this.findById(prizeId);

    if (prize.status !== 'awarded') {
      throw new BadRequestException('Prize must be awarded before marking as paid');
    }

    prize.status = 'paid';
    prize.paidAt = new Date();

    if (transactionHash) {
      prize.transactionHash = transactionHash;
    }

    const updatedPrize = await prize.save();
    this.logger.log(`Prize ${prizeId} marked as paid`);

    return updatedPrize;
  }

  /**
   * Get prizes by event
   */
  async findByEvent(eventId: string): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({ eventId })
      .sort({ rank: 1, amount: -1 })
      .exec();
  }

  /**
   * Get prizes by winner
   */
  async findByWinner(winnerId: string): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({ winner: winnerId, status: { $in: ['awarded', 'paid'] } })
      .sort({ awardedAt: -1 })
      .exec();
  }

  /**
   * Get prizes by sponsor
   */
  async findBySponsor(sponsorId: string): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({ sponsorId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get total prize pool for event
   */
  async getEventPrizePool(eventId: string): Promise<{
    total: number;
    byCurrency: Record<string, number>;
    count: number;
  }> {
    const prizes = await this.findByEvent(eventId);

    const byCurrency: Record<string, number> = {};
    let total = 0;

    prizes.forEach((prize) => {
      if (!byCurrency[prize.currency]) {
        byCurrency[prize.currency] = 0;
      }
      byCurrency[prize.currency] += prize.amount;

      // Convert to USD for total (simplified)
      if (prize.currency === 'USD') {
        total += prize.amount;
      }
      // Add conversion logic for other currencies if needed
    });

    return {
      total,
      byCurrency,
      count: prizes.length,
    };
  }

  /**
   * Get prize statistics
   */
  async getStats(): Promise<PrizeStats> {
    const prizes = await this.prizeModel.find().exec();

    const prizesByStatus: Record<string, number> = {
      pending: 0,
      awarded: 0,
      paid: 0,
      cancelled: 0,
    };

    const prizesByCategory: Record<string, number> = {};

    let totalValue = 0;

    prizes.forEach((prize) => {
      if (prize.status in prizesByStatus) {
        prizesByStatus[prize.status] += 1;
      }

      if (prize.category) {
        if (!prizesByCategory[prize.category]) {
          prizesByCategory[prize.category] = 0;
        }
        prizesByCategory[prize.category] += 1;
      }

      if (prize.currency === 'USD') {
        totalValue += prize.amount;
      }
    });

    return {
      totalPrizes: prizes.length,
      totalValue,
      prizesByStatus,
      prizesByCategory,
      averagePrizeAmount: prizes.length > 0 ? totalValue / prizes.length : 0,
    };
  }

  /**
   * Get prize distribution for event
   */
  async getDistribution(eventId: string): Promise<PrizeDistribution> {
    const prizes = await this.findByEvent(eventId);

    const winners = prizes
      .filter((p) => p.winner)
      .map((p) => ({
        prizeId: p._id.toString(),
        winner: p.winner!,
        amount: p.amount,
        status: p.status,
      }));

    const totalAmount = prizes.reduce((sum, p) => sum + p.amount, 0);

    return {
      eventId,
      totalAmount,
      prizeCount: prizes.length,
      winners,
    };
  }

  /**
   * Claim prize
   */
  async claim(prizeId: string, userId: string): Promise<PrizeDocument> {
    const prize = await this.findById(prizeId);

    if (prize.status !== 'awarded') {
      throw new BadRequestException('Prize is not available for claiming');
    }

    if (prize.winner !== userId) {
      throw new ForbiddenException('You are not the winner of this prize');
    }

    if (prize.claimedAt) {
      throw new BadRequestException('Prize has already been claimed');
    }

    prize.claimedAt = new Date();
    prize.metadata.claimAttempts += 1;

    const updatedPrize = await prize.save();
    this.logger.log(`Prize ${prizeId} claimed by ${userId}`);

    return updatedPrize;
  }

  /**
   * Check eligibility for prize
   */
  async checkEligibility(
    prizeId: string,
    userId: string,
    userCriteria: Record<string, any>,
  ): Promise<{ eligible: boolean; reasons: string[] }> {
    const prize = await this.findById(prizeId);

    const reasons: string[] = [];

    if (!prize.eligibilityCriteria || prize.eligibilityCriteria.length === 0) {
      return { eligible: true, reasons: [] };
    }

    // Simple eligibility check - can be expanded
    for (const criterion of prize.eligibilityCriteria) {
      if (!userCriteria[criterion]) {
        reasons.push(`Missing requirement: ${criterion}`);
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Update prize metadata
   */
  async updateMetadata(
    prizeId: string,
    metadata: Partial<Prize['metadata']>,
  ): Promise<PrizeDocument> {
    const prize = await this.findById(prizeId);

    prize.metadata = {
      ...prize.metadata,
      ...metadata,
    };

    return prize.save();
  }

  /**
   * Increment view count
   */
  async incrementViews(prizeId: string): Promise<void> {
    await this.prizeModel.findByIdAndUpdate(prizeId, {
      $inc: { 'metadata.views': 1 },
    });
  }

  /**
   * Increment applicant count
   */
  async incrementApplicants(prizeId: string): Promise<void> {
    await this.prizeModel.findByIdAndUpdate(prizeId, {
      $inc: { 'metadata.applicants': 1 },
    });
  }

  /**
   * Get top prizes
   */
  async getTopPrizes(limit: number = 10): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({ status: 'pending' })
      .sort({ amount: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Search prizes
   */
  async search(query: string, limit: number = 10): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } },
        ],
      })
      .limit(limit)
      .exec();
  }

  /**
   * Get pending payouts
   */
  async getPendingPayouts(): Promise<PrizeDocument[]> {
    return this.prizeModel
      .find({ status: 'awarded', paidAt: { $exists: false } })
      .sort({ awardedAt: 1 })
      .exec();
  }

  /**
   * Get prize report for event
   */
  async getEventReport(eventId: string): Promise<{
    totalPrizes: number;
    totalValue: number;
    awarded: number;
    paid: number;
    pending: number;
    distribution: Array<{ category?: string; amount: number; count: number }>;
  }> {
    const prizes = await this.findByEvent(eventId);

    const distribution: Record<string, { amount: number; count: number }> = {};

    let awarded = 0;
    let paid = 0;
    let pending = 0;
    let totalValue = 0;

    prizes.forEach((prize) => {
      totalValue += prize.amount;

      if (prize.status === 'awarded') awarded++;
      if (prize.status === 'paid') paid++;
      if (prize.status === 'pending') pending++;

      const category = prize.category || 'General';
      if (!distribution[category]) {
        distribution[category] = { amount: 0, count: 0 };
      }
      distribution[category].amount += prize.amount;
      distribution[category].count++;
    });

    const distributionArray = Object.entries(distribution).map(([category, data]) => ({
      category,
      ...data,
    }));

    return {
      totalPrizes: prizes.length,
      totalValue,
      awarded,
      paid,
      pending,
      distribution: distributionArray,
    };
  }
}

