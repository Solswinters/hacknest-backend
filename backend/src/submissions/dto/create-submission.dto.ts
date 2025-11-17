import { IsString, IsNotEmpty, Length, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({
    example: 'My Awesome DApp',
    minLength: 3,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 128)
  title: string;

  @ApiPropertyOptional({
    example: 'https://github.com/username/project',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  repo?: string;

  @ApiPropertyOptional({
    example: 'https://myproject.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @ApiProperty({
    example: '0x...',
    description: 'Signature proving submission ownership',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiPropertyOptional({
    example: 'QmXyZ...',
    description: 'IPFS hash for additional attachments',
  })
  @IsOptional()
  @IsString()
  ipfsHash?: string;
}

