import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventsService } from '../events/events.service';
import { Submission, SubmissionStatus } from './schemas/submission.schema';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let mockSubmissionModel: any;
  let mockEventsService: any;

  const mockSubmission = {
    _id: '507f1f77bcf86cd799439012',
    eventId: '507f1f77bcf86cd799439011',
    participant: '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
    title: 'Test Submission',
    repo: 'https://github.com/test/repo',
    signature: '0xabc...',
    status: SubmissionStatus.SUBMITTED,
    createdAt: new Date(),
  };

  const mockEvent = {
    _id: '507f1f77bcf86cd799439011',
    host: '0x742d35cc6634c0532925a3b844bc9e7595f0beb',
    startDate: new Date(Date.now() - 1000),
    endDate: new Date(Date.now() + 10000),
    judges: [],
  };

  beforeEach(async () => {
    mockSubmissionModel = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      save: jest.fn(),
    };

    mockSubmissionModel.mockImplementation(() => ({
      ...mockSubmission,
      save: jest.fn().mockResolvedValue(mockSubmission),
    }));

    mockEventsService = {
      findById: jest.fn().mockResolvedValue(mockEvent),
      isHost: jest.fn().mockResolvedValue(false),
      isJudge: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        {
          provide: getModelToken(Submission.name),
          useValue: mockSubmissionModel,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEvent', () => {
    it('should return submissions for an event', async () => {
      mockSubmissionModel.exec.mockResolvedValue([mockSubmission]);

      const result = await service.findByEvent('507f1f77bcf86cd799439011');

      expect(result).toEqual([mockSubmission]);
      expect(mockEventsService.findById).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update submission status', async () => {
      const mockDoc = {
        ...mockSubmission,
        status: SubmissionStatus.SUBMITTED,
        save: jest.fn().mockResolvedValue({
          ...mockSubmission,
          status: SubmissionStatus.ACCEPTED,
        }),
      };
      mockSubmissionModel.exec.mockResolvedValue(mockDoc);

      const result = await service.updateStatus(
        '507f1f77bcf86cd799439012',
        SubmissionStatus.ACCEPTED,
      );

      expect(result.status).toBe(SubmissionStatus.ACCEPTED);
    });
  });
});

