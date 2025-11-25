import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsNotEmpty, IsOptional, IsArray, IsUrl, IsEmail, IsNumber, Min } from 'class-validator';

export class CreateSponsorDto {
  @ApiProperty({ description: 'Name of the sponsor organization' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the sponsor' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL to sponsor logo' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Sponsor website URL' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiProperty({ description: 'Primary contact email' })
  @IsEmail()
  @IsNotEmpty()
  contactEmail: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact person name' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Sponsorship tier (e.g., "Platinum", "Gold", "Silver")' })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ description: 'Sponsorship amount in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Event IDs this sponsor is associated with', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata for the sponsor' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSponsorDto {
  @ApiPropertyOptional({ description: 'Name of the sponsor organization' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the sponsor' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL to sponsor logo' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Sponsor website URL' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Primary contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact person name' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Sponsorship tier (e.g., "Platinum", "Gold", "Silver")' })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ description: 'Sponsorship amount in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Additional metadata for the sponsor' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SponsorResponseDto {
  @ApiProperty({ description: 'Sponsor ID' })
  id: string;

  @ApiProperty({ description: 'Name of the sponsor organization' })
  name: string;

  @ApiProperty({ description: 'Description of the sponsor' })
  description?: string;

  @ApiProperty({ description: 'URL to sponsor logo' })
  logoUrl?: string;

  @ApiProperty({ description: 'Sponsor website URL' })
  websiteUrl?: string;

  @ApiProperty({ description: 'Primary contact email' })
  contactEmail: string;

  @ApiProperty({ description: 'Contact phone number' })
  contactPhone?: string;

  @ApiProperty({ description: 'Contact person name' })
  contactName?: string;

  @ApiProperty({ description: 'Sponsorship tier' })
  tier?: string;

  @ApiProperty({ description: 'Sponsorship amount in USD' })
  amount?: number;

  @ApiProperty({ description: 'Event IDs associated with this sponsor', type: [String] })
  eventIds: string[];

  @ApiProperty({ description: 'Additional metadata for the sponsor' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

