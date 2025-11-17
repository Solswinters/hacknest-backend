import { Module, Global } from '@nestjs/common';
import { ContractService } from './contract.service';

@Global()
@Module({
  providers: [ContractService],
  exports: [ContractService],
})
export class Web3Module {}

