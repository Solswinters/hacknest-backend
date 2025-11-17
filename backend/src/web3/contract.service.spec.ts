import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContractService } from './contract.service';

describe('ContractService', () => {
  let service: ContractService;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'web3.providerUrl': 'https://rpc.base.org',
          'web3.privateKey': '0x0000000000000000000000000000000000000000000000000000000000000001',
          'web3.chainId': 8453,
          'contracts.eventFactoryAddress': '0x0000000000000000000000000000000000000000',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProvider', () => {
    it('should return a provider instance', () => {
      const provider = service.getProvider();
      expect(provider).toBeDefined();
    });
  });

  describe('getSigner', () => {
    it('should return a signer instance', () => {
      const signer = service.getSigner();
      expect(signer).toBeDefined();
      expect(signer.address).toBeDefined();
    });
  });

  describe('createEvent', () => {
    it('should return success response when factory not configured', async () => {
      const result = await service.createEvent({
        metadataURI: 'ipfs://test',
        host: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        judges: [],
      });

      expect(result.success).toBe(true);
    });
  });
});

