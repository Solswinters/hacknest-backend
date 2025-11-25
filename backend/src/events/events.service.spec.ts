import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Event } from './schemas/event.schema';
import { EventsService } from './events.service';

describe('EventsService - Judge Management', () => {
  let service: EventsService;
  let mockEventModel: any;

  const createMockEvent = () => ({
    _id: '507f1f77bcf86cd799439011',
    host: '0xhost123',
    title: 'Test Hackathon',
    judges: ['0xjudge1', '0xjudge2'],
    save: jest.fn(),
  });

  beforeEach(async () => {
    mockEventModel = {
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('inviteJudges', () => {
    it('should add new judges to an event', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });
      mockEvent.save.mockResolvedValue({
        ...mockEvent,
        judges: ['0xjudge1', '0xjudge2', '0xjudge3'],
      });

      const result = await service.inviteJudges(
        '507f1f77bcf86cd799439011',
        ['0xJudge3'],
        '0xHost123',
      );

      expect(result.judges).toContain('0xjudge3');
      expect(mockEvent.save).toHaveBeenCalled();
    });

    it('should not add duplicate judges', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });
      mockEvent.save.mockResolvedValue(mockEvent);

      const result = await service.inviteJudges(
        '507f1f77bcf86cd799439011',
        ['0xJudge1'], // Already exists
        '0xHost123',
      );

      // Should return event without adding duplicate
      expect(result.judges.length).toBe(2);
    });

    it('should throw ForbiddenException if not host', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      await expect(
        service.inviteJudges(
          '507f1f77bcf86cd799439011',
          ['0xJudge3'],
          '0xNotHost', // Different from host
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if event not found', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      await expect(
        service.inviteJudges('nonexistent', ['0xJudge3'], '0xHost123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should normalize addresses to lowercase', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });
      mockEvent.save.mockResolvedValue({
        ...mockEvent,
        judges: ['0xjudge1', '0xjudge2', '0xjudge3'],
      });

      await service.inviteJudges(
        '507f1f77bcf86cd799439011',
        ['0xJUDGE3'], // Mixed case
        '0xHost123',
      );

      // Verify the judge was added in lowercase
      expect(mockEvent.judges).toContain('0xjudge3');
    });
  });

  describe('removeJudge', () => {
    it('should remove a judge from an event', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });
      mockEvent.save.mockResolvedValue({
        ...mockEvent,
        judges: ['0xjudge2'],
      });

      const result = await service.removeJudge(
        '507f1f77bcf86cd799439011',
        '0xJudge1',
        '0xHost123',
      );

      expect(result.judges).not.toContain('0xjudge1');
      expect(mockEvent.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not host', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      await expect(
        service.removeJudge(
          '507f1f77bcf86cd799439011',
          '0xJudge1',
          '0xNotHost',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle removing non-existent judge gracefully', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });
      mockEvent.save.mockResolvedValue(mockEvent);

      const result = await service.removeJudge(
        '507f1f77bcf86cd799439011',
        '0xNonExistentJudge',
        '0xHost123',
      );

      // Should return event without error
      expect(result).toBeDefined();
      expect(result.judges.length).toBe(2);
    });
  });

  describe('getJudges', () => {
    it('should return list of judges', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      const judges = await service.getJudges('507f1f77bcf86cd799439011');

      expect(judges).toEqual(['0xjudge1', '0xjudge2']);
    });

    it('should throw NotFoundException if event not found', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      await expect(service.getJudges('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isJudge', () => {
    it('should return true if user is a judge', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      const result = await service.isJudge(
        '507f1f77bcf86cd799439011',
        '0xJudge1',
      );

      expect(result).toBe(true);
    });

    it('should return false if user is not a judge', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      const result = await service.isJudge(
        '507f1f77bcf86cd799439011',
        '0xNotAJudge',
      );

      expect(result).toBe(false);
    });

    it('should handle case-insensitive address comparison', async () => {
      const mockEvent = createMockEvent();
      const mockExec = jest.fn().mockResolvedValue(mockEvent);
      mockEventModel.findById.mockReturnValue({ exec: mockExec });

      const result = await service.isJudge(
        '507f1f77bcf86cd799439011',
        '0xJUDGE1', // Mixed case
      );

      expect(result).toBe(true);
    });
  });
});
