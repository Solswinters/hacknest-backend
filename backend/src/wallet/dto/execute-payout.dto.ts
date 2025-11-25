import {

  IsArray,
  IsEthereumAddress,
  IsString,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PayoutRecipient {
  @ApiProperty({ description: 'Recipient wallet address' })
  @IsEthereumAddress()
  address: string;

  @ApiProperty({ description: 'Amount in wei (as string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'Amount must be a valid number in wei' })
  amount: string;
}

export class ExecutePayoutDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  eventId: string;

  @ApiProperty({ type: [PayoutRecipient], description: 'List of payout recipients' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PayoutRecipient)
  recipients: PayoutRecipient[];
}

