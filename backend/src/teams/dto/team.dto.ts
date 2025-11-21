import { IsString, IsNotEmpty, IsOptional, IsArray, IsMongoId, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({ description: 'Team name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Team description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event ID this team is participating in' })
  @IsMongoId()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional({ description: 'Maximum number of team members allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxMembers?: number;

  @ApiPropertyOptional({ description: 'Team avatar URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata for the team' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ description: 'Team name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Team description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Maximum number of team members allowed' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxMembers?: number;

  @ApiPropertyOptional({ description: 'Team avatar URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata for the team' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class InviteMemberDto {
  @ApiProperty({ description: 'ID of the user to invite' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}

export class TeamMemberDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Role in the team (e.g., "owner", "member")' })
  role: string;

  @ApiProperty({ description: 'Join timestamp' })
  joinedAt: Date;
}

export class TeamInvitationDto {
  @ApiProperty({ description: 'Invitation ID' })
  id: string;

  @ApiProperty({ description: 'ID of the user invited' })
  userId: string;

  @ApiProperty({ description: 'ID of the user who sent the invitation' })
  invitedBy: string;

  @ApiProperty({ description: 'Invitation status (e.g., "pending", "accepted", "declined")' })
  status: string;

  @ApiProperty({ description: 'Invitation creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Invitation expiration timestamp' })
  expiresAt?: Date;
}

export class TeamResponseDto {
  @ApiProperty({ description: 'Team ID' })
  id: string;

  @ApiProperty({ description: 'Team name' })
  name: string;

  @ApiProperty({ description: 'Team description' })
  description?: string;

  @ApiProperty({ description: 'Event ID this team is participating in' })
  eventId: string;

  @ApiProperty({ description: 'ID of the team owner' })
  ownerId: string;

  @ApiProperty({ description: 'Team members', type: [TeamMemberDto] })
  members: TeamMemberDto[];

  @ApiProperty({ description: 'Pending invitations', type: [TeamInvitationDto] })
  invitations: TeamInvitationDto[];

  @ApiProperty({ description: 'Maximum number of team members allowed' })
  maxMembers: number;

  @ApiProperty({ description: 'Team avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Additional metadata for the team' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

