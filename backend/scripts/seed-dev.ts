import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/events/events.service';
import { RewardCurrency } from '../src/events/schemas/event.schema';
import { UserRole } from '../src/users/schemas/user.schema';
import { UsersService } from '../src/users/users.service';

async function bootstrap() {
  console.log('🌱 Starting database seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  
  const usersService = app.get(UsersService);
  const eventsService = app.get(EventsService);

  try {
    // Create sample users
    console.log('Creating sample users...');
    
    const host = await usersService.upsertByAddress(
      '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
      { username: 'alice_host', role: UserRole.HOST },
    );
    console.log(`✓ Host created: ${host.address}`);

    const judge = await usersService.upsertByAddress(
      '0x8ba1f109551bd432803012645ac136ddd64dba72',
      { username: 'bob_judge', role: UserRole.JUDGE },
    );
    console.log(`✓ Judge created: ${judge.address}`);

    const participant1 = await usersService.upsertByAddress(
      '0xdd2fd4581271e230360230f9337d5c0430bf44c0',
      { username: 'charlie_dev', role: UserRole.PARTICIPANT },
    );
    console.log(`✓ Participant 1 created: ${participant1.address}`);

    const participant2 = await usersService.upsertByAddress(
      '0xbda5747bfd65f08deb54cb465eb87d40e51b197e',
      { username: 'diana_builder', role: UserRole.PARTICIPANT },
    );
    console.log(`✓ Participant 2 created: ${participant2.address}\n`);

    // Create sample events
    console.log('Creating sample events...');

    const event1 = await eventsService.create(
      {
        title: 'Base Summer Hackathon 2025',
        description:
          'Build the next generation of decentralized applications on Base. ' +
          'Categories include DeFi, NFTs, Gaming, and Social. ' +
          'Total prize pool: 1 ETH distributed among winners.',
        rewardCurrency: RewardCurrency.ETH,
        rewardAmount: '1000000000000000000', // 1 ETH in wei
        startDate: new Date('2025-06-01T00:00:00Z').toISOString(),
        endDate: new Date('2025-06-30T23:59:59Z').toISOString(),
        judges: [judge.address],
      },
      host.address,
    );
    console.log(`✓ Event 1 created: ${event1._id} - "${event1.title}"`);

    const event2 = await eventsService.create(
      {
        title: 'DeFi Innovation Challenge',
        description:
          'Create innovative DeFi protocols and tools. ' +
          'Focus on improving accessibility, security, and user experience. ' +
          'Prizes for the most creative and functional submissions.',
        rewardCurrency: RewardCurrency.ETH,
        rewardAmount: '500000000000000000', // 0.5 ETH in wei
        startDate: new Date('2025-07-01T00:00:00Z').toISOString(),
        endDate: new Date('2025-07-31T23:59:59Z').toISOString(),
        judges: [judge.address, host.address],
      },
      host.address,
    );
    console.log(`✓ Event 2 created: ${event2._id} - "${event2.title}"`);

    const event3 = await eventsService.create(
      {
        title: 'NFT & Gaming Hackathon',
        description:
          'Push the boundaries of blockchain gaming and NFT utilities. ' +
          'Build games, marketplaces, or novel NFT use cases. ' +
          'Show us the future of digital ownership.',
        rewardCurrency: RewardCurrency.ETH,
        rewardAmount: '750000000000000000', // 0.75 ETH in wei
        startDate: new Date('2025-08-01T00:00:00Z').toISOString(),
        endDate: new Date('2025-08-31T23:59:59Z').toISOString(),
        judges: [judge.address],
      },
      host.address,
    );
    console.log(`✓ Event 3 created: ${event3._id} - "${event3.title}"\n`);

    console.log('✅ Database seeding completed successfully!\n');
    console.log('Sample credentials:');
    console.log('─────────────────────────────────────────');
    console.log(`Host:         ${host.address}`);
    console.log(`Judge:        ${judge.address}`);
    console.log(`Participant1: ${participant1.address}`);
    console.log(`Participant2: ${participant2.address}`);
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();

