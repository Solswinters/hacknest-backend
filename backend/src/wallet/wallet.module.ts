import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletConfig, WalletConfigSchema } from './schemas/wallet-config.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from './schemas/wallet-transaction.schema';
import { EncryptionService } from './encryption.service';
import { WalletManagerService } from './wallet-manager.service';
import { EscrowService } from './escrow.service';
import { WalletController } from './wallet.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletConfig.name, schema: WalletConfigSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
    EventsModule,
  ],
  controllers: [WalletController],
  providers: [EncryptionService, WalletManagerService, EscrowService],
  exports: [EscrowService, WalletManagerService],
})
export class WalletModule {}

