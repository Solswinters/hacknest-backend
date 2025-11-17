import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { ethers } from 'ethers';
import { AppModule } from '../src/app.module';
import { ContractService } from '../src/web3/contract.service';

describe('Hacknest E2E Tests', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let testWallet: ethers.Wallet;
  let judgeWallet: ethers.Wallet;
  let jwtToken: string;
  let judgeToken: string;
  let eventId: string;
  let submissionId: string;

  // Mock ContractService for tests
  const mockContractService = {
    getProvider: jest.fn(),
    getSigner: jest.fn(),
    createEvent: jest.fn().mockResolvedValue({
      success: true,
      eventAddress: '0x1234567890123456789012345678901234567890',
      txHash: '0xabc123',
    }),
    fundEvent: jest.fn().mockResolvedValue({
      success: true,
      txHash: '0xdef456',
    }),
    payout: jest.fn().mockResolvedValue({
      success: true,
      txHash: '0xghi789',
    }),
    checkConnection: jest.fn().mockResolvedValue(true),
    getGasPrice: jest.fn().mockResolvedValue('1000000000'),
  };

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Create test wallets
    testWallet = ethers.Wallet.createRandom();
    judgeWallet = ethers.Wallet.createRandom();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        AppModule,
      ],
    })
      .overrideProvider(ContractService)
      .useValue(mockContractService)
      .compile();

    app = moduleFixture.createNestApplication();
    
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('Auth Flow', () => {
    let nonce: string;

    it('GET /api/auth/nonce - should return a nonce', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auth/nonce?address=${testWallet.address}`)
        .expect(200);

      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('expiresAt');
      nonce = response.body.nonce;
    });

    it('POST /api/auth/login - should login with valid signature', async () => {
      const message = `I am signing into Hacknest. Nonce: ${nonce}`;
      const signature = await testWallet.signMessage(message);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          address: testWallet.address,
          signature,
          nonce,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      jwtToken = response.body.token;
    });

    it('POST /api/auth/login - should reject invalid signature', async () => {
      // Get new nonce
      const nonceResponse = await request(app.getHttpServer())
        .get(`/api/auth/nonce?address=${testWallet.address}`)
        .expect(200);

      const newNonce = nonceResponse.body.nonce;
      const wrongMessage = 'Wrong message';
      const signature = await testWallet.signMessage(wrongMessage);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          address: testWallet.address,
          signature,
          nonce: newNonce,
        })
        .expect(401);
    });
  });

  describe('Judge Auth Flow', () => {
    it('should authenticate judge wallet', async () => {
      const nonceResponse = await request(app.getHttpServer())
        .get(`/api/auth/nonce?address=${judgeWallet.address}`)
        .expect(200);

      const nonce = nonceResponse.body.nonce;
      const message = `I am signing into Hacknest. Nonce: ${nonce}`;
      const signature = await judgeWallet.signMessage(message);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          address: judgeWallet.address,
          signature,
          nonce,
        })
        .expect(200);

      judgeToken = response.body.token;
    });
  });

  describe('Users', () => {
    it('GET /api/users/me - should return user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('address');
      expect(response.body.address.toLowerCase()).toBe(testWallet.address.toLowerCase());
    });

    it('GET /api/users/me - should reject without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });
  });

  describe('Events Flow', () => {
    it('POST /api/events - should create event (requires host role)', async () => {
      // Note: Default role is participant, so this will fail unless role is updated
      const eventDto = {
        title: 'Test Hackathon',
        description: 'A test hackathon event for E2E testing',
        rewardCurrency: 'ETH',
        rewardAmount: '1000000000000000000',
        startDate: new Date(Date.now() + 1000).toISOString(),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        judges: [judgeWallet.address],
      };

      // This will fail with 403 as default role is participant
      await request(app.getHttpServer())
        .post('/api/events')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(eventDto)
        .expect(403);
    });

    it('GET /api/events - should list events (public)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/events')
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Health Check', () => {
    it('GET /api/health - should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('database');
    });
  });
});

