import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Controller, Get, UseGuards, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@CurrentUser() user: { address: string }) {
    const userProfile = await this.usersService.findByAddress(user.address);
    
    if (!userProfile) {
      throw new NotFoundException('User not found');
    }
    
    return {
      address: userProfile.address,
      username: userProfile.username,
      email: userProfile.email,
      role: userProfile.role,
      profile: userProfile.profile,
      createdAt: (userProfile as any).createdAt,
    };
  }
}

