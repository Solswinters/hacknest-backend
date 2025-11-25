import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { ethers } from 'ethers';

import { Nonce } from './schemas/nonce.schema';
import { SignatureService } from './signature.service';

describe('SignatureService', () => {
  let service: SignatureService;
  let mockNonceModel: any;

  beforeEach(async () => {
    mockNonceModel = {
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureService,
        {
          provide: getModelToken(Nonce.name),
          useValue: mockNonceModel,
        },
      ],
    }).compile();

    service = module.get<SignatureService>(SignatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueNonce', () => {
    it('should generate and store a nonce', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      mockNonceModel.findOneAndUpdate.mockResolvedValue({
        address,
        nonce: 'abc123',
        expiresAt: new Date(),
      });

      const result = await service.issueNonce(address);

      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('expiresAt');
      expect(mockNonceModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      const wallet = ethers.Wallet.createRandom();
      const message = 'Test message';
      const signature = await wallet.signMessage(message);

      const isValid = service.verifySignature(message, signature, wallet.address);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', async () => {
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();
      const message = 'Test message';
      const signature = await wallet1.signMessage(message);

      const isValid = service.verifySignature(message, signature, wallet2.address);

      expect(isValid).toBe(false);
    });
  });

  describe('validateNonce', () => {
    it('should validate an existing non-expired nonce', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const nonce = 'abc123';
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);

      mockNonceModel.findOne.mockResolvedValue({
        address: address.toLowerCase(),
        nonce,
        expiresAt: futureDate,
      });

      const isValid = await service.validateNonce(address, nonce);

      expect(isValid).toBe(true);
    });

    it('should reject an expired nonce', async () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const nonce = 'abc123';
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);

      mockNonceModel.findOne.mockResolvedValue({
        address: address.toLowerCase(),
        nonce,
        expiresAt: pastDate,
      });
      mockNonceModel.deleteOne.mockResolvedValue({});

      const isValid = await service.validateNonce(address, nonce);

      expect(isValid).toBe(false);
      expect(mockNonceModel.deleteOne).toHaveBeenCalled();
    });
  });
});

