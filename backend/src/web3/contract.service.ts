import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  EVENT_FACTORY_ABI,
  EVENT_INSTANCE_ABI,
  CreateEventParams,
  PayoutParams,
  ContractResponse,
} from './interfaces/event-factory.interface';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private provider: ethers.providers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private eventFactoryAddress: string;

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  /**
   * Initialize Web3 provider and signer
   */
  private initializeProvider() {
    const providerUrl = this.configService.get<string>('web3.providerUrl');
    const privateKey = this.configService.get<string>('web3.privateKey');
    this.eventFactoryAddress = this.configService.get<string>(
      'contracts.eventFactoryAddress',
    ) || '';

    if (!providerUrl) {
      this.logger.warn('ETH_PROVIDER_URL not configured');
      return;
    }

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.logger.log(`Provider connected: ${providerUrl}`);

    if (privateKey && privateKey !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Signer configured: ${this.signer.address}`);
    } else {
      this.logger.warn('PRIVATE_KEY not configured - contract writes will fail');
    }
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.providers.JsonRpcProvider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  /**
   * Get signer instance (for write operations)
   */
  getSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error('Signer not configured - check PRIVATE_KEY');
    }
    return this.signer;
  }

  /**
   * Create event on-chain via EventFactory contract
   */
  async createEvent(params: CreateEventParams): Promise<ContractResponse> {
    try {
      if (!this.eventFactoryAddress) {
        this.logger.warn('EventFactory address not configured - skipping on-chain creation');
        return {
          success: true,
          eventAddress: ethers.constants.AddressZero,
        };
      }

      const factory = new ethers.Contract(
        this.eventFactoryAddress,
        EVENT_FACTORY_ABI,
        this.getSigner(),
      );

      this.logger.log(`Creating event on-chain for host ${params.host}`);
      
      const tx = await factory.createEvent(
        params.metadataURI,
        params.host,
        params.judges,
      );

      const receipt = await tx.wait();
      
      // Extract event address from logs (simplified)
      const eventAddress = receipt.events?.[0]?.args?.[0] || ethers.constants.AddressZero;

      this.logger.log(
        `Event created on-chain: ${eventAddress}, tx: ${receipt.transactionHash}`,
      );

      return {
        success: true,
        txHash: receipt.transactionHash,
        eventAddress,
      };
    } catch (error) {
      this.logger.error(`Error creating event on-chain: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fund event contract with ETH or tokens
   */
  async fundEvent(eventAddress: string, amount: string): Promise<ContractResponse> {
    try {
      this.logger.log(`Funding event ${eventAddress} with ${amount} wei`);

      const tx = await this.getSigner().sendTransaction({
        to: eventAddress,
        value: ethers.BigNumber.from(amount),
      });

      const receipt = await tx.wait();

      this.logger.log(`Event funded: ${eventAddress}, tx: ${receipt.transactionHash}`);

      return {
        success: true,
        txHash: receipt.transactionHash,
      };
    } catch (error) {
      this.logger.error(`Error funding event: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute payout to winners
   */
  async payout(params: PayoutParams): Promise<ContractResponse> {
    try {
      const { eventAddress, winners, amounts } = params;

      if (winners.length !== amounts.length) {
        throw new Error('Winners and amounts arrays must have same length');
      }

      this.logger.log(
        `Executing payout for event ${eventAddress} to ${winners.length} winner(s)`,
      );

      // For MVP, direct distribution
      // In production, this would call the event contract's distribute function
      const eventContract = new ethers.Contract(
        eventAddress,
        EVENT_INSTANCE_ABI,
        this.getSigner(),
      );

      // Calculate total amount
      const totalAmount = amounts.reduce(
        (sum, amt) => sum.add(ethers.BigNumber.from(amt)),
        ethers.BigNumber.from(0),
      );

      const tx = await eventContract.distribute(winners, amounts, {
        value: totalAmount,
      });

      const receipt = await tx.wait();

      this.logger.log(
        `Payout executed successfully, tx: ${receipt.transactionHash}`,
      );

      return {
        success: true,
        txHash: receipt.transactionHash,
      };
    } catch (error) {
      this.logger.error(`Error executing payout: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check provider connection health
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.provider) {
        return false;
      }
      const blockNumber = await this.provider.getBlockNumber();
      this.logger.debug(`Current block number: ${blockNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Provider connection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<string> {
    const gasPrice = await this.getProvider().getGasPrice();
    return gasPrice.toString();
  }
}

