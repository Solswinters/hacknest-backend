import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ethers } from 'ethers';
import {
  WalletTransaction,
  WalletTransactionDocument,
  TransactionType,
  TransactionStatus,
} from './schemas/wallet-transaction.schema';
import { WalletManagerService } from './wallet-manager.service';
import { EventsService } from '../events/events.service';

/**
 * Escrow service for managing deposits and payouts
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private readonly ESCROW_WALLET_NAME = 'main-escrow';
  private readonly MIN_CONFIRMATIONS = 3;

  constructor(
    @InjectModel(WalletTransaction.name)
    private transactionModel: Model<WalletTransactionDocument>,
    private walletManager: WalletManagerService,
    private eventsService: EventsService,
  ) {}

  /**
   * Get escrow wallet address for deposits
   */
  async getEscrowAddress(): Promise<string> {
    try {
      return await this.walletManager.getWalletAddress(this.ESCROW_WALLET_NAME);
    } catch (error) {
      // If escrow wallet doesn't exist, create it
      this.logger.warn('Escrow wallet not found, creating new one...');
      const result = await this.walletManager.generateWallet(this.ESCROW_WALLET_NAME);
      
      this.logger.log(`🔐 NEW ESCROW WALLET CREATED!`);
      this.logger.log(`Address: ${result.address}`);
      this.logger.warn(`⚠️  BACKUP MNEMONIC (write it down): ${result.mnemonic}`);
      
      return result.address;
    }
  }

  /**
   * Record a deposit transaction (from host)
   */
  async recordDeposit(
    fromAddress: string,
    amount: string,
    eventId: string,
    txHash?: string,
  ): Promise<WalletTransactionDocument> {
    const escrowAddress = await this.getEscrowAddress();

    // Verify event exists
    await this.eventsService.findById(eventId);

    const transaction = new this.transactionModel({
      type: TransactionType.DEPOSIT,
      from: fromAddress.toLowerCase(),
      to: escrowAddress.toLowerCase(),
      amount,
      txHash,
      status: txHash ? TransactionStatus.PENDING : TransactionStatus.CONFIRMED,
      eventId: new Types.ObjectId(eventId),
      initiatedBy: fromAddress.toLowerCase(),
      description: `Deposit for event ${eventId}`,
    });

    await transaction.save();

    this.logger.log(
      `Deposit recorded: ${amount} wei from ${fromAddress} for event ${eventId}`,
    );

    return transaction;
  }

  /**
   * Execute payout from escrow to winners
   */
  async executePayout(
    eventId: string,
    recipients: Array<{ address: string; amount: string }>,
    initiatedBy: string,
  ): Promise<WalletTransactionDocument[]> {
    // Validate recipients
    if (!recipients || recipients.length === 0) {
      throw new BadRequestException('No recipients provided');
    }

    // Load escrow wallet
    const escrowWallet = await this.walletManager.loadWallet(this.ESCROW_WALLET_NAME);

    // Check balance
    const balance = await escrowWallet.getBalance();
    const totalPayout = recipients.reduce(
      (sum, r) => sum.add(ethers.BigNumber.from(r.amount)),
      ethers.BigNumber.from(0),
    );

    if (balance.lt(totalPayout)) {
      throw new BadRequestException(
        `Insufficient balance. Required: ${ethers.utils.formatEther(totalPayout)} ETH, Available: ${ethers.utils.formatEther(balance)} ETH`,
      );
    }

    const transactions: WalletTransactionDocument[] = [];

    // Execute each payout
    for (const recipient of recipients) {
      try {
        this.logger.log(
          `Sending ${ethers.utils.formatEther(recipient.amount)} ETH to ${recipient.address}`,
        );

        // Send transaction
        const tx = await escrowWallet.sendTransaction({
          to: recipient.address,
          value: ethers.BigNumber.from(recipient.amount),
        });

        // Record transaction
        const transaction = new this.transactionModel({
          type: TransactionType.PAYOUT,
          from: escrowWallet.address.toLowerCase(),
          to: recipient.address.toLowerCase(),
          amount: recipient.amount,
          txHash: tx.hash,
          status: TransactionStatus.PENDING,
          eventId: new Types.ObjectId(eventId),
          initiatedBy: initiatedBy.toLowerCase(),
          description: `Payout for event ${eventId}`,
          metadata: {
            gasPrice: tx.gasPrice?.toString(),
          },
        });

        await transaction.save();
        transactions.push(transaction);

        // Wait for confirmation (async)
        this.waitForConfirmation(tx, transaction._id.toString());

        this.logger.log(`Payout sent: ${tx.hash}`);
      } catch (error) {
        this.logger.error(
          `Failed to send payout to ${recipient.address}: ${error.message}`,
        );

        // Record failed transaction
        const failedTx = new this.transactionModel({
          type: TransactionType.PAYOUT,
          from: escrowWallet.address.toLowerCase(),
          to: recipient.address.toLowerCase(),
          amount: recipient.amount,
          status: TransactionStatus.FAILED,
          eventId: new Types.ObjectId(eventId),
          initiatedBy: initiatedBy.toLowerCase(),
          errorMessage: error.message,
        });

        await failedTx.save();
        transactions.push(failedTx);
      }
    }

    return transactions;
  }

  /**
   * Wait for transaction confirmation (async)
   */
  private async waitForConfirmation(
    tx: ethers.providers.TransactionResponse,
    transactionId: string,
  ): Promise<void> {
    try {
      const receipt = await tx.wait(this.MIN_CONFIRMATIONS);

      // Update transaction status
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.CONFIRMED,
        'metadata.gasUsed': receipt.gasUsed.toString(),
        'metadata.blockNumber': receipt.blockNumber,
        'metadata.confirmations': receipt.confirmations,
      });

      this.logger.log(
        `Transaction confirmed: ${tx.hash} (${receipt.confirmations} confirmations)`,
      );
    } catch (error) {
      this.logger.error(`Transaction failed: ${tx.hash} - ${error.message}`);

      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }

  /**
   * Get escrow balance
   */
  async getEscrowBalance(): Promise<{
    balance: string;
    balanceEth: string;
  }> {
    return this.walletManager.getBalance(this.ESCROW_WALLET_NAME);
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(filters?: {
    eventId?: string;
    type?: TransactionType;
    status?: TransactionStatus;
    limit?: number;
  }): Promise<WalletTransactionDocument[]> {
    const query: any = {};

    if (filters?.eventId) {
      query.eventId = new Types.ObjectId(filters.eventId);
    }
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    return this.transactionModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 100)
      .exec();
  }

  /**
   * Get total deposits for an event
   */
  async getEventDeposits(eventId: string): Promise<{
    total: string;
    totalEth: string;
    transactions: WalletTransactionDocument[];
  }> {
    const transactions = await this.transactionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CONFIRMED,
      })
      .exec();

    const total = transactions.reduce(
      (sum, tx) => sum.add(ethers.BigNumber.from(tx.amount)),
      ethers.BigNumber.from(0),
    );

    return {
      total: total.toString(),
      totalEth: ethers.utils.formatEther(total),
      transactions,
    };
  }
}

