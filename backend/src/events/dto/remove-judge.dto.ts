import {
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveJudgeDto {
  @ApiProperty({
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Judge wallet address to remove',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Judge address must be a valid Ethereum address',
  })
  judgeAddress: string;
}

