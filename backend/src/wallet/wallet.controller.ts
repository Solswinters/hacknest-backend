import {

  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WalletManagerService } from './wallet-manager.service';
import { EscrowService } from './escrow.service';
import { RecordDepositDto } from './dto/record-deposit.dto';
import { ExecutePayoutDto } from './dto/execute-payout.dto';
import { TransactionType, TransactionStatus } from './schemas/wallet-transaction.schema';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private walletManager: WalletManagerService,
    private escrowService: EscrowService,
  ) {}

  @Get('escrow/address')
  @ApiOperation({ summary: 'Get escrow wallet address for deposits (Public)' })
  @ApiResponse({ status: 200, description: 'Escrow address returned' })
  async getEscrowAddress() {
    const address = await this.escrowService.getEscrowAddress();
    
    return {
      address,
      message: 'Send event deposits to this address',
    };
  }

  @Get('escrow/balance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('host', 'judge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get escrow wallet balance (Host/Judge)' })
  @ApiResponse({ status: 200, description: 'Balance returned' })
  async getEscrowBalance() {
    const balance = await this.escrowService.getEscrowBalance();
    
    return {
      balance: balance.balance,
      balanceEth: balance.balanceEth,
      address: await this.escrowService.getEscrowAddress(),
    };
  }

  @Post('deposit/record')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('host')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a deposit transaction (Host)' })
  @ApiResponse({ status: 201, description: 'Deposit recorded' })
  async recordDeposit(
    @Body() recordDepositDto: RecordDepositDto,
    @CurrentUser() user: { address: string },
  ) {
    const transaction = await this.escrowService.recordDeposit(
      recordDepositDto.fromAddress,
      recordDepositDto.amount,
      recordDepositDto.eventId,
      recordDepositDto.txHash,
    );

    return {
      transactionId: transaction._id,
      status: transaction.status,
      message: 'Deposit recorded successfully',
    };
  }

  @Post('payout/execute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('host')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute payout to winners (Host)' })
  @ApiResponse({ status: 200, description: 'Payouts executed' })
  async executePayout(
    @Body() executePayoutDto: ExecutePayoutDto,
    @CurrentUser() user: { address: string },
  ) {
    const transactions = await this.escrowService.executePayout(
      executePayoutDto.eventId,
      executePayoutDto.recipients,
      user.address,
    );

    return {
      transactions: transactions.map((tx) => ({
        id: tx._id,
        to: tx.to,
        amount: tx.amount,
        txHash: tx.txHash,
        status: tx.status,
      })),
      message: `${transactions.length} payout(s) initiated`,
    };
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('host', 'judge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction history (Host/Judge)' })
  @ApiQuery({ name: 'eventId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Transactions returned' })
  async getTransactions(
    @Query('eventId') eventId?: string,
    @Query('type') type?: TransactionType,
    @Query('status') status?: TransactionStatus,
    @Query('limit') limit?: number,
  ) {
    const transactions = await this.escrowService.getTransactionHistory({
      eventId,
      type,
      status,
      limit: limit ? parseInt(limit.toString()) : 100,
    });

    return {
      transactions: transactions.map((tx) => ({
        id: tx._id,
        type: tx.type,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        txHash: tx.txHash,
        status: tx.status,
        eventId: tx.eventId,
        createdAt: (tx as any).createdAt,
      })),
      count: transactions.length,
    };
  }

  @Get('events/:eventId/deposits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deposits for a specific event' })
  @ApiResponse({ status: 200, description: 'Event deposits returned' })
  async getEventDeposits(@Param('eventId') eventId: string) {
    const deposits = await this.escrowService.getEventDeposits(eventId);

    return {
      eventId,
      total: deposits.total,
      totalEth: deposits.totalEth,
      deposits: deposits.transactions.map((tx) => ({
        id: tx._id,
        from: tx.from,
        amount: tx.amount,
        txHash: tx.txHash,
        createdAt: (tx as any).createdAt,
      })),
    };
  }
}

