import {
  IsArray,
  ArrayNotEmpty,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteJudgesDto {
  @ApiProperty({
    example: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', '0x123d35Cc6634C0532925a3b844Bc9e7595f0abc'],
    description: 'Array of judge wallet addresses to invite',
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
}

