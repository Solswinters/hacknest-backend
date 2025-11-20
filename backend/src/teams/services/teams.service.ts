import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from '../schemas/team.schema';

export interface CreateTeamDto {
  name: string;
  description?: string;
  eventId?: string;
  logo?: string;
  tags?: string[];
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  logo?: string;
  tags?: string[];
}

export interface TeamStats {
  totalTeams: number;
  activeTeams: number;
  averageTeamSize: number;
  topTeams: Array<{ teamId: string; name: string; memberCount: number }>;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
  ) {}

  /**
   * Create a new team
   */
  async create(createTeamDto: CreateTeamDto, leaderAddress: string): Promise<TeamDocument> {
    const team = new this.teamModel({
      ...createTeamDto,
      leader: leaderAddress.toLowerCase(),
      members: [leaderAddress.toLowerCase()],
      isActive: true,
      stats: {
        totalSubmissions: 0,
        totalWins: 0,
        totalParticipations: 0,
        averageScore: 0,
      },
    });

    const savedTeam = await team.save();
    this.logger.log(`Team created: ${savedTeam._id} by ${leaderAddress}`);
    
    return savedTeam;
  }

  /**
   * Find team by ID
   */
  async findById(teamId: string): Promise<TeamDocument> {
    const team = await this.teamModel.findById(teamId).exec();

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    return team;
  }

  /**
   * Find all teams
   */
  async findAll(filters?: {
    isActive?: boolean;
    eventId?: string;
    tag?: string;
  }): Promise<TeamDocument[]> {
    const query: any = {};

    if (filters) {
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      if (filters.eventId) {
        query.eventId = filters.eventId;
      }
      if (filters.tag) {
        query.tags = filters.tag;
      }
    }

    return this.teamModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Update team
   */
  async update(
    teamId: string,
    updateTeamDto: UpdateTeamDto,
    userAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    // Verify user is the leader
    if (team.leader !== userAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can update the team');
    }

    Object.assign(team, updateTeamDto);
    
    const updatedTeam = await team.save();
    this.logger.log(`Team updated: ${teamId} by ${userAddress}`);
    
    return updatedTeam;
  }

  /**
   * Add member to team
   */
  async addMember(
    teamId: string,
    memberAddress: string,
    leaderAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    // Verify user is the leader
    if (team.leader !== leaderAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can add members');
    }

    const normalizedAddress = memberAddress.toLowerCase();

    // Check if already a member
    if (team.members.includes(normalizedAddress)) {
      throw new BadRequestException('User is already a team member');
    }

    // Remove from pending invites if present
    team.pendingInvites = team.pendingInvites.filter(
      (addr) => addr !== normalizedAddress,
    );

    team.members.push(normalizedAddress);
    
    const updatedTeam = await team.save();
    this.logger.log(`Added member ${memberAddress} to team ${teamId}`);
    
    return updatedTeam;
  }

  /**
   * Remove member from team
   */
  async removeMember(
    teamId: string,
    memberAddress: string,
    leaderAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    // Verify user is the leader
    if (team.leader !== leaderAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can remove members');
    }

    const normalizedAddress = memberAddress.toLowerCase();

    // Cannot remove the leader
    if (normalizedAddress === team.leader) {
      throw new BadRequestException('Cannot remove the team leader');
    }

    const initialLength = team.members.length;
    team.members = team.members.filter((addr) => addr !== normalizedAddress);

    if (team.members.length === initialLength) {
      throw new NotFoundException('Member not found in team');
    }

    const updatedTeam = await team.save();
    this.logger.log(`Removed member ${memberAddress} from team ${teamId}`);
    
    return updatedTeam;
  }

  /**
   * Invite user to team
   */
  async inviteMember(
    teamId: string,
    memberAddress: string,
    leaderAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    // Verify user is the leader
    if (team.leader !== leaderAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can invite members');
    }

    const normalizedAddress = memberAddress.toLowerCase();

    // Check if already invited
    if (team.pendingInvites.includes(normalizedAddress)) {
      throw new BadRequestException('User already has a pending invite');
    }

    // Check if already a member
    if (team.members.includes(normalizedAddress)) {
      throw new BadRequestException('User is already a team member');
    }

    team.pendingInvites.push(normalizedAddress);
    
    const updatedTeam = await team.save();
    this.logger.log(`Invited ${memberAddress} to team ${teamId}`);
    
    return updatedTeam;
  }

  /**
   * Accept team invite
   */
  async acceptInvite(
    teamId: string,
    memberAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    const normalizedAddress = memberAddress.toLowerCase();

    // Check if user has pending invite
    if (!team.pendingInvites.includes(normalizedAddress)) {
      throw new BadRequestException('No pending invite found');
    }

    // Remove from pending invites
    team.pendingInvites = team.pendingInvites.filter(
      (addr) => addr !== normalizedAddress,
    );

    // Add to members
    team.members.push(normalizedAddress);
    
    const updatedTeam = await team.save();
    this.logger.log(`${memberAddress} accepted invite to team ${teamId}`);
    
    return updatedTeam;
  }

  /**
   * Reject team invite
   */
  async rejectInvite(
    teamId: string,
    memberAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    const normalizedAddress = memberAddress.toLowerCase();

    // Check if user has pending invite
    if (!team.pendingInvites.includes(normalizedAddress)) {
      throw new BadRequestException('No pending invite found');
    }

    // Remove from pending invites
    team.pendingInvites = team.pendingInvites.filter(
      (addr) => addr !== normalizedAddress,
    );
    
    const updatedTeam = await team.save();
    this.logger.log(`${memberAddress} rejected invite to team ${teamId}`);
    
    return updatedTeam;
  }

  /**
   * Leave team
   */
  async leaveTeam(teamId: string, memberAddress: string): Promise<void> {
    const team = await this.findById(teamId);

    const normalizedAddress = memberAddress.toLowerCase();

    // Leader cannot leave, must transfer leadership first
    if (team.leader === normalizedAddress) {
      throw new BadRequestException(
        'Team leader must transfer leadership before leaving',
      );
    }

    team.members = team.members.filter((addr) => addr !== normalizedAddress);
    
    await team.save();
    this.logger.log(`${memberAddress} left team ${teamId}`);
  }

  /**
   * Transfer leadership
   */
  async transferLeadership(
    teamId: string,
    newLeaderAddress: string,
    currentLeaderAddress: string,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    // Verify user is current leader
    if (team.leader !== currentLeaderAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can transfer leadership');
    }

    const normalizedAddress = newLeaderAddress.toLowerCase();

    // Verify new leader is a team member
    if (!team.members.includes(normalizedAddress)) {
      throw new BadRequestException('New leader must be a team member');
    }

    team.leader = normalizedAddress;
    
    const updatedTeam = await team.save();
    this.logger.log(
      `Leadership of team ${teamId} transferred to ${newLeaderAddress}`,
    );
    
    return updatedTeam;
  }

  /**
   * Disband team
   */
  async disband(teamId: string, leaderAddress: string): Promise<void> {
    const team = await this.findById(teamId);

    // Verify user is the leader
    if (team.leader !== leaderAddress.toLowerCase()) {
      throw new ForbiddenException('Only the team leader can disband the team');
    }

    team.isActive = false;
    team.disbandedAt = new Date();
    
    await team.save();
    this.logger.log(`Team disbanded: ${teamId} by ${leaderAddress}`);
  }

  /**
   * Get user's teams
   */
  async getUserTeams(userAddress: string): Promise<TeamDocument[]> {
    const normalizedAddress = userAddress.toLowerCase();

    return this.teamModel
      .find({
        members: normalizedAddress,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get teams where user is leader
   */
  async getUserLeaderTeams(userAddress: string): Promise<TeamDocument[]> {
    const normalizedAddress = userAddress.toLowerCase();

    return this.teamModel
      .find({
        leader: normalizedAddress,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get pending invites for user
   */
  async getUserPendingInvites(userAddress: string): Promise<TeamDocument[]> {
    const normalizedAddress = userAddress.toLowerCase();

    return this.teamModel
      .find({
        pendingInvites: normalizedAddress,
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Update team stats
   */
  async updateStats(
    teamId: string,
    stats: Partial<Team['stats']>,
  ): Promise<TeamDocument> {
    const team = await this.findById(teamId);

    team.stats = {
      ...team.stats,
      ...stats,
    };

    return team.save();
  }

  /**
   * Get team statistics
   */
  async getTeamStats(): Promise<TeamStats> {
    const teams = await this.teamModel.find({ isActive: true }).exec();

    const totalMembers = teams.reduce(
      (sum, team) => sum + team.members.length,
      0,
    );

    const topTeams = teams
      .sort((a, b) => b.members.length - a.members.length)
      .slice(0, 10)
      .map((team) => ({
        teamId: team._id.toString(),
        name: team.name,
        memberCount: team.members.length,
      }));

    return {
      totalTeams: teams.length,
      activeTeams: teams.filter((t) => t.isActive).length,
      averageTeamSize: teams.length > 0 ? totalMembers / teams.length : 0,
      topTeams,
    };
  }

  /**
   * Search teams
   */
  async search(query: string, limit: number = 10): Promise<TeamDocument[]> {
    return this.teamModel
      .find({
        $text: { $search: query },
        isActive: true,
      })
      .limit(limit)
      .exec();
  }
}

