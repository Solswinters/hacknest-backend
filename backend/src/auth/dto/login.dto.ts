import { ApiProperty } from '@nestjs/swagger';

import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Ethereum wallet address',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  address: string;

  @ApiProperty({
    example: '0x...',
    description: 'Signature of the nonce message',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    example: 'abc123...',
    description: 'Nonce received from /auth/nonce',
  })
  @IsString()
  @IsNotEmpty()
  nonce: string;
}

