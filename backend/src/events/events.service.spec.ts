import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventsService } from './events.service';
import { Event, EventStatus, RewardCurrency } from './schemas/event.schema';
import { NotFoundException } from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;
  let mockEventModel: any;

  const mockEvent = {
    _id: '507f1f77bcf86cd799439011',
    host: '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
    title: 'Test Hackathon',
    description: 'Test description',
    rewardCurrency: RewardCurrency.ETH,
    rewardAmount: '1000000000000000000',
    startDate: new Date('2025-12-01'),
    endDate: new Date('2025-12-15'),
    judges: ['0x742d35cc6634c0532925a3b844bc9e7595f0beb'],
    status: EventStatus.DRAFT,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockEventModel = {
      find: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      countDocuments: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      save: jest.fn(),
    };

    // Mock constructor
    mockEventModel.mockImplementation(() => ({
      ...mockEvent,
      save: jest.fn().mockResolvedValue(mockEvent),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getModelToken(Event.name),
          useValue: mockEventModel,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an event', async () => {
      const createDto = {
        title: 'Test Hackathon',
        description: 'Test description',
        rewardCurrency: RewardCurrency.ETH,
        rewardAmount: '1000000000000000000',
        startDate: '2025-12-01T00:00:00Z',
        endDate: '2025-12-15T00:00:00Z',
        judges: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
      };

      const result = await service.create(createDto, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');

      expect(result).toBeDefined();
      expect(result.title).toBe(createDto.title);
    });
  });

  describe('findById', () => {
    it('should return an event by id', async () => {
      mockEventModel.exec.mockResolvedValue(mockEvent);

      const result = await service.findById('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockEvent);
    });

    it('should throw NotFoundException if event not found', async () => {
      mockEventModel.exec.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated events', async () => {
      const events = [mockEvent];
      mockEventModel.exec.mockResolvedValue(events);
      mockEventModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.events).toEqual(events);
      expect(result.pagination.total).toBe(1);
    });
  });
});

