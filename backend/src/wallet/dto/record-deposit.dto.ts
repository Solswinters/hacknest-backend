import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsEthereumAddress, Matches, IsOptional } from 'class-validator';

export class RecordDepositDto {
  @ApiProperty({ description: 'Sender wallet address' })
  @IsEthereumAddress()
  fromAddress: string;

  @ApiProperty({ description: 'Amount in wei (as string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'Amount must be a valid number in wei' })
  amount: string;

  @ApiProperty({ description: 'Event ID' })
  @IsString()
  eventId: string;

  @ApiPropertyOptional({ description: 'Blockchain transaction hash' })
  @IsOptional()
  @IsString()
  txHash?: string;
}

