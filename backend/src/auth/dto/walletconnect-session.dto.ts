import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsOptional, Matches } from 'class-validator';

export class GetSessionDto {
  @ApiProperty({
    description: 'WalletConnect session topic',
    example: 'c9e4e9e4a8f8d8e4f8e4a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8',
  })
  @IsString()
  topic: string;
}

export class DisconnectSessionDto {
  @ApiProperty({
    description: 'WalletConnect session topic to disconnect',
    example: 'c9e4e9e4a8f8d8e4f8e4a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8',
  })
  @IsString()
  topic: string;
}

export class GetSessionsByAddressDto {
  @ApiProperty({
    description: 'Wallet address to search sessions for',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Address must be a valid Ethereum address',
  })
  address: string;
}

export class VerifySessionDto {
  @ApiProperty({
    description: 'WalletConnect session topic',
    example: 'c9e4e9e4a8f8d8e4f8e4a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8e4f8a8d8',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    description: 'Wallet address to verify',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Address must be a valid Ethereum address',
  })
  address: string;
}

export class SessionStatsResponseDto {
  @ApiProperty({
    description: 'Total number of sessions',
    example: 15,
  })
  total: number;

  @ApiProperty({
    description: 'Number of active sessions',
    example: 12,
  })
  active: number;

  @ApiProperty({
    description: 'Number of expired sessions',
    example: 3,
  })
  expired: number;

  @ApiProperty({
    description: 'Number of acknowledged sessions',
    example: 12,
  })
  acknowledged: number;

  @ApiProperty({
    description: 'Sessions grouped by wallet type',
    example: { 'MetaMask': 5, 'Trust Wallet': 3, 'Rainbow': 4 },
  })
  byWallet: Record<string, number>;

  @ApiProperty({
    description: 'Sessions grouped by namespace',
    example: { 'eip155': 12 },
  })
  byNamespace: Record<string, number>;
}

