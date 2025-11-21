/**
 * Auth Service Tests - Unit tests for authentication service
 * HIGH PRIORITY: Testing coverage for security-critical components
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SignatureService } from './signature.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let signatureService: jest.Mocked<SignatureService>;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    _id: '123',
    address: '0x1234567890123456789012345678901234567890',
    username: 'testuser',
    role: 'participant',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNonce = 'test-nonce-123';

  beforeEach(async () => {
    const mockSignatureService = {
      issueNonce: jest.fn(),
      validateNonce: jest.fn(),
      constructMessage: jest.fn(),
      verifySignature: jest.fn(),
      consumeNonce: jest.fn(),
    };

    const mockUsersService = {
      findByAddress: jest.fn(),
      upsertByAddress: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SignatureService, useValue: mockSignatureService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    signatureService = module.get(SignatureService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('issueNonce', () => {
    it('should issue a nonce for an address', async () => {
      const nonceData = { nonce: mockNonce, expiresAt: new Date() };
      signatureService.issueNonce.mockResolvedValue(nonceData);

      const result = await service.issueNonce(mockUser.address);

      expect(result).toEqual(nonceData);
      expect(signatureService.issueNonce).toHaveBeenCalledWith(mockUser.address);
    });
  });

  describe('login', () => {
    const loginDto = {
      address: mockUser.address,
      signature: '0xvalidsignature',
      nonce: mockNonce,
    };

    it('should return login response for valid credentials', async () => {
      const accessToken = 'jwt.token.here';

      signatureService.validateNonce.mockResolvedValue(true);
      signatureService.constructMessage.mockReturnValue('Sign this message');
      signatureService.verifySignature.mockReturnValue(true);
      signatureService.consumeNonce.mockResolvedValue(undefined);
      usersService.upsertByAddress.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue(accessToken);

      const result = await service.login(loginDto);

      expect(result.token).toBe(accessToken);
      expect(result.user.address).toBe(mockUser.address.toLowerCase());
      expect(signatureService.consumeNonce).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid nonce', async () => {
      signatureService.validateNonce.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      signatureService.validateNonce.mockResolvedValue(true);
      signatureService.constructMessage.mockReturnValue('Sign this message');
      signatureService.verifySignature.mockReturnValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('should return payload for valid token', async () => {
      const token = 'valid.jwt.token';
      const decoded = { sub: mockUser.address, role: mockUser.role };

      jwtService.verify.mockReturnValue(decoded as any);

      const result = await service.validateToken(token);

      expect(result).toEqual(decoded);
      expect(jwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid.token';

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateToken(token);

      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should generate new token for valid address', async () => {
      const newToken = 'new.jwt.token';

      usersService.findByAddress.mockResolvedValue(mockUser as any);
      jwtService.sign.mockReturnValue(newToken);

      const result = await service.refreshToken(mockUser.address);

      expect(result.token).toBe(newToken);
      expect(result.user.address).toBe(mockUser.address.toLowerCase());
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByAddress.mockResolvedValue(null);

      await expect(service.refreshToken(mockUser.address)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});

