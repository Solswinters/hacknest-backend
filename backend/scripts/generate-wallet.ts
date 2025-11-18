import { ethers } from 'ethers';

/**
 * Generate a new Ethereum wallet
 * Usage: ts-node scripts/generate-wallet.ts
 */

console.log('🔐 Generating new Ethereum wallet...\n');

// Create random wallet
const wallet = ethers.Wallet.createRandom();

console.log('✅ Wallet Generated Successfully!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 Address:');
console.log(wallet.address);
console.log('\n🔑 Private Key (KEEP SECRET!):');
console.log(wallet.privateKey);
console.log('\n📝 Mnemonic Phrase (KEEP SECRET!):');
console.log(wallet.mnemonic.phrase);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('⚠️  SECURITY WARNING:');
console.log('   • Never share your private key or mnemonic');
console.log('   • Store them securely (use a password manager)');
console.log('   • For production, use hardware wallets or HSM\n');

// Generate a few more for testing
console.log('📋 Additional Test Wallets:\n');
for (let i = 1; i <= 3; i++) {
  const testWallet = ethers.Wallet.createRandom();
  console.log(`Wallet ${i}:`);
  console.log(`  Address: ${testWallet.address}`);
  console.log(`  Private Key: ${testWallet.privateKey}\n`);
}

