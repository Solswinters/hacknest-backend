import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { WalletConfig, WalletConfigDocument } from './schemas/wallet-config.schema';
import { EncryptionService } from './encryption.service';

/**
 * Secure wallet manager
 * Handles encrypted storage and retrieval of wallet private keys
 */
@Injectable()
export class WalletManagerService {
  private readonly logger = new Logger(WalletManagerService.name);
  private provider: ethers.providers.JsonRpcProvider;
  private walletCache: Map<string, { wallet: ethers.Wallet; cachedAt: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectModel(WalletConfig.name)
    private walletConfigModel: Model<WalletConfigDocument>,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    const providerUrl = this.configService.get<string>('web3.providerUrl');
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
  }

  /**
   * Generate and securely store a new wallet
   */
  async generateWallet(name: string): Promise<{
    address: string;
    mnemonic: string;
  }> {
    // Check if wallet already exists
    const existing = await this.walletConfigModel.findOne({ name });
    if (existing) {
      throw new Error(`Wallet with name "${name}" already exists`);
    }

    // Generate new random wallet
    const wallet = ethers.Wallet.createRandom();

    // Encrypt private key
    const encrypted = this.encryptionService.encrypt(wallet.privateKey);

    // Store encrypted wallet
    const walletConfig = new this.walletConfigModel({
      name,
      address: wallet.address,
      encryptedPrivateKey: encrypted.encrypted,
      iv: encrypted.iv,
      salt: encrypted.salt,
      authTag: encrypted.authTag,
      isActive: true,
    });

    await walletConfig.save();

    this.logger.log(`New wallet created: ${name} (${wallet.address})`);

    // Return mnemonic for backup (ONLY returned once!)
    return {
      address: wallet.address,
      mnemonic: wallet.mnemonic.phrase,
    };
  }

  /**
   * Load wallet from encrypted storage (cached for performance)
   */
  async loadWallet(name: string): Promise<ethers.Wallet> {
    // Check cache first
    const cached = this.walletCache.get(name);
    if (cached && Date.now() - cached.cachedAt < this.cacheTimeout) {
      this.logger.debug(`Using cached wallet: ${name}`);
      return cached.wallet;
    }

    // Load from database
    const config = await this.walletConfigModel.findOne({ name, isActive: true });
    
    if (!config) {
      throw new NotFoundException(`Wallet "${name}" not found or inactive`);
    }

    try {
      // Decrypt private key
      const privateKey = this.encryptionService.decrypt(
        config.encryptedPrivateKey,
        config.iv,
        config.salt,
        config.authTag,
      );

      // Create wallet instance
      const wallet = new ethers.Wallet(privateKey, this.provider);

      // Cache wallet
      this.walletCache.set(name, {
        wallet,
        cachedAt: Date.now(),
      });

      // Update last used
      config.lastUsed = new Date();
      await config.save();

      this.logger.log(`Wallet loaded: ${name} (${wallet.address})`);

      // Securely wipe decrypted key from memory
      this.encryptionService.secureWipe(privateKey);

      return wallet;
    } catch (error) {
      this.logger.error(`Failed to load wallet "${name}": ${error.message}`);
      throw new Error('Failed to load wallet - check master password');
    }
  }

  /**
   * Get wallet address without loading private key
   */
  async getWalletAddress(name: string): Promise<string> {
    const config = await this.walletConfigModel.findOne({ name, isActive: true });
    
    if (!config) {
      throw new NotFoundException(`Wallet "${name}" not found`);
    }

    return config.address;
  }

  /**
   * Get wallet balance
   */
  async getBalance(name: string): Promise<{
    balance: string;
    balanceEth: string;
  }> {
    const address = await this.getWalletAddress(name);
    const balance = await this.provider.getBalance(address);

    return {
      balance: balance.toString(),
      balanceEth: ethers.utils.formatEther(balance),
    };
  }

  /**
   * List all wallets (without private keys)
   */
  async listWallets(): Promise<Array<{
    name: string;
    address: string;
    isActive: boolean;
    lastUsed?: Date;
  }>> {
    const wallets = await this.walletConfigModel.find();
    
    return wallets.map((w) => ({
      name: w.name,
      address: w.address,
      isActive: w.isActive,
      lastUsed: w.lastUsed,
    }));
  }

  /**
   * Deactivate wallet (soft delete)
   */
  async deactivateWallet(name: string): Promise<void> {
    const config = await this.walletConfigModel.findOne({ name });
    
    if (!config) {
      throw new NotFoundException(`Wallet "${name}" not found`);
    }

    config.isActive = false;
    await config.save();

    // Remove from cache
    this.walletCache.delete(name);

    this.logger.warn(`Wallet deactivated: ${name}`);
  }

  /**
   * Clear wallet cache (for security)
   */
  clearCache(): void {
    this.walletCache.clear();
    this.logger.log('Wallet cache cleared');
  }
}

