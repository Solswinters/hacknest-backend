import {

  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TeamsService } from '../services/teams.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMemberDto,
  UpdateTeamMemberDto,
  TeamFilterDto,
} from '../dto/team.dto';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  private readonly logger = new Logger(TeamsController.name);

  constructor(private readonly teamsService: TeamsService) {}

  /**
   * Create a new team
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTeam(@Body() createTeamDto: CreateTeamDto, @Request() req) {
    try {
      this.logger.log(`Creating team: ${createTeamDto.name} by user ${req.user.userId}`);
      const team = await this.teamsService.createTeam(createTeamDto, req.user.userId);
      return {
        success: true,
        message: 'Team created successfully',
        data: team,
      };
    } catch (error) {
      this.logger.error('Failed to create team:', error);
      throw new BadRequestException(error.message || 'Failed to create team');
    }
  }

  /**
   * Get all teams with optional filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  async getAllTeams(@Query() filterDto: TeamFilterDto) {
    try {
      this.logger.log('Fetching all teams with filters');
      const { teams, total, page, limit } = await this.teamsService.getAllTeams(filterDto);
      return {
        success: true,
        message: 'Teams retrieved successfully',
        data: teams,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch teams:', error);
      throw new BadRequestException(error.message || 'Failed to fetch teams');
    }
  }

  /**
   * Get team by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching team: ${id}`);
      const team = await this.teamsService.getTeamById(id);
      if (!team) {
        throw new NotFoundException(`Team with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Team retrieved successfully',
        data: team,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch team ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to fetch team');
    }
  }

  /**
   * Get teams by event ID
   */
  @Get('event/:eventId')
  @ApiOperation({ summary: 'Get teams by event ID' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  async getTeamsByEventId(@Param('eventId') eventId: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    try {
      this.logger.log(`Fetching teams for event: ${eventId}`);
      const { teams, total } = await this.teamsService.getTeamsByEventId(eventId, page, limit);
      return {
        success: true,
        message: 'Teams retrieved successfully',
        data: teams,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch teams for event ${eventId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch teams');
    }
  }

  /**
   * Get user's teams
   */
  @Get('user/my-teams')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user\'s teams' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyTeams(@Request() req) {
    try {
      this.logger.log(`Fetching teams for user: ${req.user.userId}`);
      const teams = await this.teamsService.getTeamsByUserId(req.user.userId);
      return {
        success: true,
        message: 'Teams retrieved successfully',
        data: teams,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user teams:', error);
      throw new BadRequestException(error.message || 'Failed to fetch teams');
    }
  }

  /**
   * Update team
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can update' })
  async updateTeam(
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Updating team: ${id} by user ${req.user.userId}`);
      
      // Check if user is team leader
      const isLeader = await this.teamsService.isTeamLeader(id, req.user.userId);
      if (!isLeader) {
        throw new ForbiddenException('Only team leaders can update the team');
      }

      const updatedTeam = await this.teamsService.updateTeam(id, updateTeamDto, req.user.userId);
      if (!updatedTeam) {
        throw new NotFoundException(`Team with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Team updated successfully',
        data: updatedTeam,
      };
    } catch (error) {
      this.logger.error(`Failed to update team ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update team');
    }
  }

  /**
   * Delete team
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete team' })
  @ApiResponse({ status: 204, description: 'Team deleted successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can delete' })
  async deleteTeam(@Param('id') id: string, @Request() req) {
    try {
      this.logger.log(`Deleting team: ${id} by user ${req.user.userId}`);
      
      // Check if user is team leader
      const isLeader = await this.teamsService.isTeamLeader(id, req.user.userId);
      if (!isLeader) {
        throw new ForbiddenException('Only team leaders can delete the team');
      }

      const deleted = await this.teamsService.deleteTeam(id, req.user.userId);
      if (!deleted) {
        throw new NotFoundException(`Team with ID ${id} not found`);
      }
      return {
        success: true,
        message: 'Team deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete team ${id}:`, error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to delete team');
    }
  }

  /**
   * Add member to team
   */
  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add member to team' })
  @ApiResponse({ status: 200, description: 'Member added successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can add members' })
  async addTeamMember(
    @Param('id') teamId: string,
    @Body() addMemberDto: AddTeamMemberDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Adding member to team ${teamId} by user ${req.user.userId}`);
      
      // Check if user is team leader
      const isLeader = await this.teamsService.isTeamLeader(teamId, req.user.userId);
      if (!isLeader) {
        throw new ForbiddenException('Only team leaders can add members');
      }

      const result = await this.teamsService.addTeamMember(teamId, addMemberDto, req.user.userId);
      return {
        success: true,
        message: 'Member added successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to add member to team ${teamId}:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to add member');
    }
  }

  /**
   * Update team member
   */
  @Put(':teamId/members/:memberId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team member' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can update members' })
  async updateTeamMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberDto: UpdateTeamMemberDto,
    @Request() req,
  ) {
    try {
      this.logger.log(`Updating member ${memberId} in team ${teamId} by user ${req.user.userId}`);
      
      // Check if user is team leader
      const isLeader = await this.teamsService.isTeamLeader(teamId, req.user.userId);
      if (!isLeader) {
        throw new ForbiddenException('Only team leaders can update members');
      }

      const result = await this.teamsService.updateTeamMember(teamId, memberId, updateMemberDto, req.user.userId);
      return {
        success: true,
        message: 'Member updated successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to update member ${memberId}:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to update member');
    }
  }

  /**
   * Remove member from team
   */
  @Delete(':teamId/members/:memberId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from team' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Team or member not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can remove members' })
  async removeTeamMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    try {
      this.logger.log(`Removing member ${memberId} from team ${teamId} by user ${req.user.userId}`);
      
      // Check if user is team leader or removing themselves
      const isLeader = await this.teamsService.isTeamLeader(teamId, req.user.userId);
      const isSelf = memberId === req.user.userId;
      
      if (!isLeader && !isSelf) {
        throw new ForbiddenException('Only team leaders can remove members, or members can remove themselves');
      }

      await this.teamsService.removeTeamMember(teamId, memberId, req.user.userId);
      return {
        success: true,
        message: 'Member removed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to remove member ${memberId}:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to remove member');
    }
  }

  /**
   * Get team members
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get team members' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamMembers(@Param('id') teamId: string) {
    try {
      this.logger.log(`Fetching members for team: ${teamId}`);
      const members = await this.teamsService.getTeamMembers(teamId);
      return {
        success: true,
        message: 'Members retrieved successfully',
        data: members,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch members for team ${teamId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch members');
    }
  }

  /**
   * Get team statistics
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get team statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamStats(@Param('id') teamId: string) {
    try {
      this.logger.log(`Fetching statistics for team: ${teamId}`);
      const stats = await this.teamsService.getTeamStatistics(teamId);
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch statistics for team ${teamId}:`, error);
      throw new BadRequestException(error.message || 'Failed to fetch statistics');
    }
  }

  /**
   * Send team invitation
   */
  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send team invitation' })
  @ApiResponse({ status: 200, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only team leaders can send invitations' })
  async sendTeamInvitation(
    @Param('id') teamId: string,
    @Body() body: { userEmail: string },
    @Request() req,
  ) {
    try {
      this.logger.log(`Sending invitation from team ${teamId} to ${body.userEmail}`);
      
      // Check if user is team leader
      const isLeader = await this.teamsService.isTeamLeader(teamId, req.user.userId);
      if (!isLeader) {
        throw new ForbiddenException('Only team leaders can send invitations');
      }

      const invitation = await this.teamsService.sendTeamInvitation(teamId, body.userEmail, req.user.userId);
      return {
        success: true,
        message: 'Invitation sent successfully',
        data: invitation,
      };
    } catch (error) {
      this.logger.error(`Failed to send invitation:`, error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to send invitation');
    }
  }

  /**
   * Accept team invitation
   */
  @Post('invitations/:invitationId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept team invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acceptTeamInvitation(@Param('invitationId') invitationId: string, @Request() req) {
    try {
      this.logger.log(`Accepting team invitation ${invitationId} by user ${req.user.userId}`);
      const result = await this.teamsService.acceptTeamInvitation(invitationId, req.user.userId);
      return {
        success: true,
        message: 'Invitation accepted successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to accept invitation ${invitationId}:`, error);
      throw new BadRequestException(error.message || 'Failed to accept invitation');
    }
  }

  /**
   * Reject team invitation
   */
  @Post('invitations/:invitationId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject team invitation' })
  @ApiResponse({ status: 200, description: 'Invitation rejected successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rejectTeamInvitation(@Param('invitationId') invitationId: string, @Request() req) {
    try {
      this.logger.log(`Rejecting team invitation ${invitationId} by user ${req.user.userId}`);
      await this.teamsService.rejectTeamInvitation(invitationId, req.user.userId);
      return {
        success: true,
        message: 'Invitation rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject invitation ${invitationId}:`, error);
      throw new BadRequestException(error.message || 'Failed to reject invitation');
    }
  }
}

