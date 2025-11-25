import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { Model } from 'mongoose';

import { User, UserDocument, UserRole } from './schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Find user by wallet address
   */
  async findByAddress(address: string): Promise<UserDocument | null> {
    if (!address) return null;
    const normalizedAddress = address.toLowerCase();
    try {
      return await this.userModel.findOne({ address: normalizedAddress }).exec();
    } catch (error) {
      this.logger.error(`Error finding user by address ${address}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Upsert user by address (create if doesn't exist)
   */
  async upsertByAddress(
    address: string,
    data?: Partial<User>,
  ): Promise<UserDocument> {
    const normalizedAddress = address.toLowerCase();

    const user = await this.userModel.findOneAndUpdate(
      { address: normalizedAddress },
      {
        address: normalizedAddress,
        ...data,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    this.logger.log(`User upserted: ${normalizedAddress}`);
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    address: string,
    updates: Partial<User>,
  ): Promise<UserDocument> {
    const normalizedAddress = address.toLowerCase();
    
    const user = await this.userModel.findOneAndUpdate(
      { address: normalizedAddress },
      { $set: updates },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User profile updated: ${normalizedAddress}`);
    return user;
  }

  /**
   * Update user role (admin function)
   */
  async updateRole(address: string, role: UserRole): Promise<UserDocument> {
    const normalizedAddress = address.toLowerCase();
    
    const user = await this.userModel.findOneAndUpdate(
      { address: normalizedAddress },
      { role },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User role updated: ${normalizedAddress} -> ${role}`);
    return user;
  }

  /**
   * Get user statistics
   */
  async getUserStats(address: string): Promise<{
    eventsHosted: number
    eventsJudged: number
    submissionsCount: number
  }> {
    const normalizedAddress = address.toLowerCase();
    const user = await this.findByAddress(normalizedAddress);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // These would be populated from other collections
    // Placeholder implementation
    return {
      eventsHosted: 0,
      eventsJudged: 0,
      submissionsCount: 0,
    };
  }

  /**
   * Check if user exists
   */
  async exists(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();
    const count = await this.userModel.countDocuments({ address: normalizedAddress });
    return count > 0;
  }

  /**
   * Get all users with pagination
   */
  async findAll(page = 1, limit = 10): Promise<{
    users: UserDocument[]
    total: number
    page: number
    totalPages: number
  }> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role }).exec();
  }

  /**
   * Delete user account
   */
  async deleteUser(address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    
    const result = await this.userModel.deleteOne({ address: normalizedAddress });

    if (result.deletedCount === 0) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User deleted: ${normalizedAddress}`);
  }

  /**
   * Get total user count
   */
  async getTotalCount(): Promise<number> {
    return this.userModel.countDocuments();
  }

  /**
   * Get recent users
   */
  async getRecentUsers(limit = 10): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

