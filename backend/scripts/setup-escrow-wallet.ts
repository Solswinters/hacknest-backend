import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WalletManagerService } from '../src/wallet/wallet-manager.service';

/**
 * Setup script to initialize the escrow wallet
 * Run once during deployment: npm run setup:escrow
 */
async function bootstrap() {
  console.log('🔐 Setting up Hacknest Escrow Wallet...\n');

  // Create app context
  const app = await NestFactory.createApplicationContext(AppModule);
  const walletManager = app.get(WalletManagerService);

  try {
    // Check if escrow wallet already exists
    try {
      const address = await walletManager.getWalletAddress('main-escrow');
      console.log('✅ Escrow wallet already exists!');
      console.log(`   Address: ${address}\n`);
      
      const balance = await walletManager.getBalance('main-escrow');
      console.log(`   Balance: ${balance.balanceEth} ETH\n`);
    } catch (error) {
      // Wallet doesn't exist, create it
      console.log('Creating new escrow wallet...\n');
      
      const result = await walletManager.generateWallet('main-escrow');
      
      console.log('✅ Escrow wallet created successfully!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📍 Wallet Address:');
      console.log(`   ${result.address}\n`);
      console.log('🔑 MNEMONIC PHRASE (BACKUP IMMEDIATELY!):');
      console.log(`   ${result.mnemonic}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('⚠️  CRITICAL SECURITY STEPS:');
      console.log('   1. Write down the mnemonic phrase on paper');
      console.log('   2. Store it in a secure location (safe, vault)');
      console.log('   3. NEVER store it digitally or share it');
      console.log('   4. This is the ONLY time you will see the mnemonic');
      console.log('   5. The private key is encrypted in the database\n');
      
      console.log('📝 Configuration:');
      console.log('   • Private key: Encrypted with AES-256-GCM');
      console.log('   • Master password: From WALLET_MASTER_PASSWORD env');
      console.log('   • Key derivation: PBKDF2 (100,000 iterations)');
      console.log('   • Storage: MongoDB (encrypted)\n');
      
      console.log('💡 Next Steps:');
      console.log('   1. Fund this wallet with ETH for gas fees');
      console.log('   2. Hosts will deposit event funds to this address');
      console.log('   3. Payouts will be sent from this wallet\n');
    }
  } catch (error) {
    console.error('❌ Error setting up escrow wallet:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();

