import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument, TeamMember, TeamInvitation } from '../schemas/team.schema';
import { CreateTeamDto, UpdateTeamDto, TeamResponseDto } from '../dto/team.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectModel(Team.name)
    private teamModel: Model<TeamDocument>,
  ) {}

  /**
   * Create a new team
   */
  async createTeam(userId: string, createTeamDto: CreateTeamDto): Promise<TeamResponseDto> {
    this.logger.log(`Creating team: ${createTeamDto.name} by user ${userId}`);

    // Check if team with same name exists for this event
    const existing = await this.teamModel
      .findOne({ eventId: createTeamDto.eventId, name: createTeamDto.name })
      .exec();

    if (existing) {
      throw new BadRequestException('Team with this name already exists for this event');
    }

    const ownerMember: TeamMember = {
      userId,
      role: 'owner',
      joinedAt: new Date(),
    };

    const team = new this.teamModel({
      ...createTeamDto,
      ownerId: userId,
      members: [ownerMember],
      invitations: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await team.save();
    return this.mapToResponseDto(saved);
  }

  /**
   * Find all teams with pagination and filtering
   */
  async findAllTeams(
    paginationDto: PaginationDto,
    search?: string,
    eventId?: string,
    memberId?: string,
  ): Promise<{ data: TeamResponseDto[]; total: number }> {
    const { page = 0, limit = 10 } = paginationDto;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (eventId) {
      query.eventId = eventId;
    }

    if (memberId) {
      query['members.userId'] = memberId;
    }

    const [teams, total] = await Promise.all([
      this.teamModel
        .find(query)
        .skip(page * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.teamModel.countDocuments(query).exec(),
    ]);

    return {
      data: teams.map((team) => this.mapToResponseDto(team)),
      total,
    };
  }

  /**
   * Find a team by ID
   */
  async findTeamById(id: string): Promise<TeamResponseDto> {
    const team = await this.teamModel.findById(id).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return this.mapToResponseDto(team);
  }

  /**
   * Update a team
   */
  async updateTeam(userId: string, id: string, updateTeamDto: UpdateTeamDto): Promise<TeamResponseDto> {
    this.logger.log(`Updating team: ${id} by user ${userId}`);

    const team = await this.teamModel.findById(id).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Check if user is the owner
    if (team.ownerId !== userId) {
      throw new ForbiddenException('Only the team owner can update the team');
    }

    Object.assign(team, updateTeamDto);
    team.updatedAt = new Date();

    const updated = await team.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Delete a team
   */
  async deleteTeam(userId: string, id: string): Promise<void> {
    this.logger.log(`Deleting team: ${id} by user ${userId}`);

    const team = await this.teamModel.findById(id).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    // Check if user is the owner
    if (team.ownerId !== userId) {
      throw new ForbiddenException('Only the team owner can delete the team');
    }

    await this.teamModel.deleteOne({ _id: id }).exec();
  }

  /**
   * Invite a member to the team
   */
  async inviteMember(ownerId: string, teamId: string, userId: string): Promise<TeamResponseDto> {
    this.logger.log(`Inviting user ${userId} to team ${teamId}`);

    const team = await this.teamModel.findById(teamId).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check if user is the owner
    if (team.ownerId !== ownerId) {
      throw new ForbiddenException('Only the team owner can invite members');
    }

    // Check if user is already a member
    if (team.members.some((m) => m.userId === userId)) {
      throw new BadRequestException('User is already a member of this team');
    }

    // Check if there's already a pending invitation
    if (team.invitations.some((inv) => inv.userId === userId && inv.status === 'pending')) {
      throw new BadRequestException('User already has a pending invitation');
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team has reached maximum capacity');
    }

    // Create invitation
    const invitation: TeamInvitation = {
      id: uuidv4(),
      userId,
      invitedBy: ownerId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    team.invitations.push(invitation);
    team.updatedAt = new Date();

    const updated = await team.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Accept a team invitation
   */
  async acceptInvitation(userId: string, teamId: string, invitationId: string): Promise<TeamResponseDto> {
    this.logger.log(`User ${userId} accepting invitation ${invitationId} for team ${teamId}`);

    const team = await this.teamModel.findById(teamId).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const invitation = team.invitations.find((inv) => inv.id === invitationId);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.userId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation has already been processed');
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await team.save();
      throw new BadRequestException('Invitation has expired');
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team has reached maximum capacity');
    }

    // Add member
    const newMember: TeamMember = {
      userId,
      role: 'member',
      joinedAt: new Date(),
    };

    team.members.push(newMember);
    invitation.status = 'accepted';
    team.updatedAt = new Date();

    const updated = await team.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Decline a team invitation
   */
  async declineInvitation(userId: string, teamId: string, invitationId: string): Promise<void> {
    this.logger.log(`User ${userId} declining invitation ${invitationId} for team ${teamId}`);

    const team = await this.teamModel.findById(teamId).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const invitation = team.invitations.find((inv) => inv.id === invitationId);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.userId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation has already been processed');
    }

    invitation.status = 'declined';
    team.updatedAt = new Date();

    await team.save();
  }

  /**
   * Remove a member from the team
   */
  async removeMember(ownerId: string, teamId: string, memberId: string): Promise<TeamResponseDto> {
    this.logger.log(`Owner ${ownerId} removing member ${memberId} from team ${teamId}`);

    const team = await this.teamModel.findById(teamId).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Check if user is the owner
    if (team.ownerId !== ownerId) {
      throw new ForbiddenException('Only the team owner can remove members');
    }

    // Can't remove the owner
    if (memberId === ownerId) {
      throw new BadRequestException('Cannot remove the team owner');
    }

    // Remove member
    team.members = team.members.filter((m) => m.userId !== memberId);
    team.updatedAt = new Date();

    const updated = await team.save();
    return this.mapToResponseDto(updated);
  }

  /**
   * Get teams for a specific user
   */
  async getTeamsForUser(userId: string): Promise<TeamResponseDto[]> {
    const teams = await this.teamModel.find({ 'members.userId': userId }).exec();
    return teams.map((team) => this.mapToResponseDto(team));
  }

  /**
   * Get teams for a specific event
   */
  async getTeamsForEvent(eventId: string): Promise<TeamResponseDto[]> {
    const teams = await this.teamModel.find({ eventId }).exec();
    return teams.map((team) => this.mapToResponseDto(team));
  }

  /**
   * Map team document to response DTO
   */
  private mapToResponseDto(team: TeamDocument): TeamResponseDto {
    return {
      id: team._id.toString(),
      name: team.name,
      description: team.description,
      eventId: team.eventId,
      ownerId: team.ownerId,
      members: team.members,
      invitations: team.invitations,
      maxMembers: team.maxMembers,
      avatarUrl: team.avatarUrl,
      metadata: team.metadata,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
