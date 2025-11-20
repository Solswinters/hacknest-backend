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

interface NetworkInfo {
  chainId: number;
  name: string;
  blockNumber: number;
  gasPrice: string;
}

interface TransactionStatus {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  confirmations: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
}

interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
}

interface BalanceInfo {
  address: string;
  balance: string;
  formattedBalance: string;
}

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private provider: ethers.providers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private eventFactoryAddress: string;
  private networkInfo: NetworkInfo | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor(private configService: ConfigService) {
    this.initializeProvider();
  }

  /**
   * Retry helper for failed operations
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < retries) {
          this.logger.warn(`Operation failed (attempt ${i + 1}/${retries}), retrying...`);
          await this.delay(this.RETRY_DELAY * (i + 1));
        }
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialize Web3 provider and signer
   */
  private async initializeProvider() {
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

    // Fetch and cache network info
    try {
      await this.refreshNetworkInfo();
    } catch (error) {
      this.logger.error(`Failed to fetch network info: ${error.message}`);
    }
  }

  /**
   * Refresh network information
   */
  async refreshNetworkInfo(): Promise<NetworkInfo> {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    const gasPrice = await this.provider.getGasPrice();

    this.networkInfo = {
      chainId: network.chainId,
      name: network.name,
      blockNumber,
      gasPrice: gasPrice.toString(),
    };

    return this.networkInfo;
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

  /**
   * Get network information
   */
  async getNetworkInfo(refresh: boolean = false): Promise<NetworkInfo> {
    if (refresh || !this.networkInfo) {
      await this.refreshNetworkInfo();
    }
    return this.networkInfo!;
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    to: string,
    data: string,
    value?: string,
  ): Promise<GasEstimate> {
    const gasLimit = await this.provider.estimateGas({
      to,
      data,
      value: value ? ethers.BigNumber.from(value) : undefined,
    });

    const feeData = await this.provider.getFeeData();

    const gasPrice = feeData.gasPrice || ethers.BigNumber.from(0);
    const estimatedCost = gasLimit.mul(gasPrice);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
      estimatedCost: estimatedCost.toString(),
    };
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const tx = await this.provider.getTransaction(txHash);
    const receipt = await this.provider.getTransactionReceipt(txHash);

    if (!tx) {
      throw new Error(`Transaction ${txHash} not found`);
    }

    let status: 'pending' | 'success' | 'failed' = 'pending';
    if (receipt) {
      status = receipt.status === 1 ? 'success' : 'failed';
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;

    return {
      hash: txHash,
      status,
      blockNumber: receipt?.blockNumber,
      confirmations,
      gasUsed: receipt?.gasUsed.toString(),
      effectiveGasPrice: receipt?.effectiveGasPrice.toString(),
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
    timeout: number = 60000, // 60 seconds
  ): Promise<ethers.providers.TransactionReceipt> {
    this.logger.log(
      `Waiting for transaction ${txHash} with ${confirmations} confirmations...`,
    );

    try {
      const receipt = await Promise.race([
        this.provider.waitForTransaction(txHash, confirmations),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), timeout),
        ),
      ]);

      this.logger.log(
        `Transaction ${txHash} confirmed in block ${receipt.blockNumber}`,
      );

      return receipt;
    } catch (error) {
      this.logger.error(`Error waiting for transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string): Promise<BalanceInfo> {
    const balance = await this.provider.getBalance(address);
    const formattedBalance = ethers.utils.formatEther(balance);

    return {
      address,
      balance: balance.toString(),
      formattedBalance,
    };
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(
    tokenAddress: string,
    holderAddress: string,
  ): Promise<string> {
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
    ];

    const contract = new ethers.Contract(
      tokenAddress,
      erc20Abi,
      this.provider,
    );

    const balance = await contract.balanceOf(holderAddress);
    return balance.toString();
  }

  /**
   * Validate Ethereum address
   */
  isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }

  /**
   * Get contract code at address
   */
  async getContractCode(address: string): Promise<string> {
    return await this.provider.getCode(address);
  }

  /**
   * Check if address is a contract
   */
  async isContract(address: string): Promise<boolean> {
    const code = await this.getContractCode(address);
    return code !== '0x';
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber: number | 'latest'): Promise<ethers.providers.Block> {
    return await this.provider.getBlock(blockNumber);
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(signedTx: string): Promise<ContractResponse> {
    try {
      const tx = await this.provider.sendTransaction(signedTx);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash,
      };
    } catch (error) {
      this.logger.error(`Error sending raw transaction: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Estimate transaction cost in ETH
   */
  async estimateTransactionCost(
    to: string,
    data: string,
    value?: string,
  ): Promise<string> {
    const estimate = await this.estimateGas(to, data, value);
    return ethers.utils.formatEther(estimate.estimatedCost);
  }

  /**
   * Get multiple balances in one call
   */
  async getMultipleBalances(addresses: string[]): Promise<BalanceInfo[]> {
    const balancePromises = addresses.map((address) => this.getBalance(address));
    return await Promise.all(balancePromises);
  }

  /**
   * Monitor pending transactions
   */
  onPendingTransaction(callback: (txHash: string) => void): () => void {
    this.provider.on('pending', callback);

    return () => {
      this.provider.off('pending', callback);
    };
  }

  /**
   * Monitor new blocks
   */
  onNewBlock(callback: (blockNumber: number) => void): () => void {
    this.provider.on('block', callback);

    return () => {
      this.provider.off('block', callback);
    };
  }

  /**
   * Get transaction count (nonce) for address
   */
  async getTransactionCount(address: string): Promise<number> {
    return await this.provider.getTransactionCount(address);
  }

  /**
   * Sign message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer not configured');
    }
    return await this.signer.signMessage(message);
  }

  /**
   * Recover address from signed message
   */
  recoverAddress(message: string, signature: string): string {
    return ethers.utils.verifyMessage(message, signature);
  }

  /**
   * Get signer address
   */
  getSignerAddress(): string {
    if (!this.signer) {
      throw new Error('Signer not configured');
    }
    return this.signer.address;
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return !!this.provider && !!this.networkInfo;
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    connected: boolean;
    chainId: number;
    blockNumber: number;
    gasPrice: string;
    signerConfigured: boolean;
    signerAddress?: string;
    signerBalance?: string;
  }> {
    const connected = await this.checkConnection();
    const network = await this.getNetworkInfo();
    const gasPrice = await this.getGasPrice();

    const stats: any = {
      connected,
      chainId: network.chainId,
      blockNumber: network.blockNumber,
      gasPrice,
      signerConfigured: !!this.signer,
    };

    if (this.signer) {
      stats.signerAddress = this.signer.address;
      const balance = await this.getBalance(this.signer.address);
      stats.signerBalance = balance.formattedBalance;
    }

    return stats;
  }
}

