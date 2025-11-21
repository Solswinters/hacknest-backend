import { IsString, IsNotEmpty, IsOptional, IsMongoId, IsNumber, Min, IsEnum, IsEthereumAddress } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PrizeStatus {
  AVAILABLE = 'available',
  AWARDED = 'awarded',
  PAYOUT_PENDING = 'payout_pending',
  PAYOUT_INITIATED = 'payout_initiated',
  PAID = 'paid',
  PAYOUT_FAILED = 'payout_failed',
}

export enum PrizeTokenType {
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
  DAI = 'DAI',
  CUSTOM = 'CUSTOM',
}

export class CreatePrizeDto {
  @ApiProperty({ description: 'Prize name (e.g., "1st Place", "Best Design")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Prize description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event ID this prize belongs to' })
  @IsMongoId()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: 'Prize amount (in token units)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Token type for the prize', enum: PrizeTokenType })
  @IsEnum(PrizeTokenType)
  tokenType: PrizeTokenType;

  @ApiPropertyOptional({ description: 'Custom token contract address (if tokenType is CUSTOM)' })
  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @ApiPropertyOptional({ description: 'Prize rank or position (1 for 1st place, etc.)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rank?: number;

  @ApiPropertyOptional({ description: 'Sponsor ID who is funding this prize' })
  @IsOptional()
  @IsMongoId()
  sponsorId?: string;

  @ApiPropertyOptional({ description: 'Additional metadata for the prize' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePrizeDto {
  @ApiPropertyOptional({ description: 'Prize name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Prize description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Prize amount (in token units)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Token type for the prize', enum: PrizeTokenType })
  @IsOptional()
  @IsEnum(PrizeTokenType)
  tokenType?: PrizeTokenType;

  @ApiPropertyOptional({ description: 'Custom token contract address' })
  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @ApiPropertyOptional({ description: 'Prize rank or position' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rank?: number;

  @ApiPropertyOptional({ description: 'Additional metadata for the prize' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class AwardPrizeDto {
  @ApiProperty({ description: 'ID of the submission that won the prize' })
  @IsMongoId()
  @IsNotEmpty()
  submissionId: string;

  @ApiProperty({ description: 'ID of the winner (user)' })
  @IsMongoId()
  @IsNotEmpty()
  winnerId: string;
}

export class PayoutRequestDto {
  @ApiProperty({ description: 'Wallet address to send the prize to' })
  @IsEthereumAddress()
  @IsNotEmpty()
  walletAddress: string;
}

export class PrizeResponseDto {
  @ApiProperty({ description: 'Prize ID' })
  id: string;

  @ApiProperty({ description: 'Prize name' })
  name: string;

  @ApiProperty({ description: 'Prize description' })
  description?: string;

  @ApiProperty({ description: 'Event ID this prize belongs to' })
  eventId: string;

  @ApiProperty({ description: 'Prize amount (in token units)' })
  amount: number;

  @ApiProperty({ description: 'Token type for the prize', enum: PrizeTokenType })
  tokenType: PrizeTokenType;

  @ApiProperty({ description: 'Custom token contract address (if applicable)' })
  tokenAddress?: string;

  @ApiProperty({ description: 'Prize rank or position' })
  rank?: number;

  @ApiProperty({ description: 'Sponsor ID who is funding this prize' })
  sponsorId?: string;

  @ApiProperty({ description: 'Current prize status', enum: PrizeStatus })
  status: PrizeStatus;

  @ApiProperty({ description: 'ID of the submission that won the prize' })
  awardedToSubmissionId?: string;

  @ApiProperty({ description: 'ID of the winner' })
  winnerId?: string;

  @ApiProperty({ description: 'Wallet address for payout' })
  payoutWalletAddress?: string;

  @ApiProperty({ description: 'Transaction hash of the payout' })
  payoutTransactionHash?: string;

  @ApiProperty({ description: 'Timestamp when payout was initiated' })
  payoutInitiatedAt?: Date;

  @ApiProperty({ description: 'Timestamp when payout was completed' })
  payoutCompletedAt?: Date;

  @ApiProperty({ description: 'Additional metadata for the prize' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

