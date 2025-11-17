import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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
    const normalizedAddress = address.toLowerCase();
    return this.userModel.findOne({ address: normalizedAddress }).exec();
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
}

