import {

  IsString,
  IsEnum,
  IsDateString,
  Length,
  MaxLength,
  Matches,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RewardCurrency } from '../schemas/event.schema';

export class CreateEventDto {
  @ApiProperty({
    example: 'Base Hackathon 2025',
    minLength: 3,
    maxLength: 128,
  })
  @IsString()
  @Length(3, 128)
  title: string;

  @ApiProperty({
    example: 'Build the next generation of decentralized applications on Base',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiProperty({
    enum: RewardCurrency,
    example: RewardCurrency.ETH,
  })
  @IsEnum(RewardCurrency)
  rewardCurrency: RewardCurrency;

  @ApiProperty({
    example: '1000000000000000000',
    description: 'Reward amount in wei or smallest token unit',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'Reward amount must be a positive integer string' })
  rewardAmount: string;

  @ApiProperty({
    example: '2025-12-01T00:00:00Z',
    description: 'Event start date in ISO8601 format',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2025-12-15T23:59:59Z',
    description: 'Event end date in ISO8601 format',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    example: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
    description: 'Array of judge wallet addresses',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    each: true,
    message: 'Each judge address must be a valid Ethereum address',
  })
  judges: string[];

  @ApiProperty({
    example: 'https://hackathon-banner.com/image.png',
    description: 'Event banner image URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Banner must be a valid URL' })
  bannerUrl?: string;
}

