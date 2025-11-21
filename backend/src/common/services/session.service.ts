/**
 * Session Management Service - Secure session tracking and management
 * HIGH PRIORITY: Critical for maintaining user sessions securely
 */

import { Injectable, Logger } from '@nestjs/common';

export interface Session {
  id: string;
  userId: string;
  userAddress: string;
  token: string;
  refreshToken?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  ip: string;
  userAgent: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface SessionConfig {
  sessionDuration: number; // milliseconds
  refreshTokenDuration: number; // milliseconds
  maxSessionsPerUser: number;
  idleTimeout: number; // milliseconds
  slidingExpiration: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private config: SessionConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      sessionDuration: config?.sessionDuration || 3600000, // 1 hour
      refreshTokenDuration: config?.refreshTokenDuration || 604800000, // 7 days
      maxSessionsPerUser: config?.maxSessionsPerUser || 5,
      idleTimeout: config?.idleTimeout || 1800000, // 30 minutes
      slidingExpiration: config?.slidingExpiration !== false,
    };

    // Cleanup expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);
  }

  /**
   * Create a new session
   */
  createSession(
    userId: string,
    userAddress: string,
    token: string,
    ip: string,
    userAgent: string,
    metadata: Record<string, unknown> = {}
  ): Session {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      userId,
      userAddress,
      token,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionDuration),
      lastActivityAt: now,
      ip,
      userAgent,
      isActive: true,
      metadata,
    };

    // Check max sessions per user
    const userSessionIds = this.userSessions.get(userId) || new Set();
    if (userSessionIds.size >= this.config.maxSessionsPerUser) {
      // Remove oldest session
      const oldestSessionId = this.getOldestSession(userId);
      if (oldestSessionId) {
        this.destroySession(oldestSessionId);
      }
    }

    // Store session
    this.sessions.set(sessionId, session);

    // Track user session
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    this.logger.log(`Session created for user ${userId}`);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.destroySession(sessionId);
      return undefined;
    }

    // Check idle timeout
    const now = Date.now();
    const idleTime = now - session.lastActivityAt.getTime();
    if (idleTime > this.config.idleTimeout) {
      this.destroySession(sessionId);
      return undefined;
    }

    return session;
  }

  /**
   * Get session by token
   */
  getSessionByToken(token: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.token === token) {
        return this.getSession(session.id);
      }
    }
    return undefined;
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    const sessions: Session[] = [];

    for (const sessionId of sessionIds) {
      const session = this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive) {
      return false;
    }

    session.lastActivityAt = new Date();

    // Sliding expiration
    if (this.config.slidingExpiration) {
      session.expiresAt = new Date(
        Date.now() + this.config.sessionDuration
      );
    }

    return true;
  }

  /**
   * Refresh session
   */
  refreshSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    const now = new Date();
    session.expiresAt = new Date(now.getTime() + this.config.sessionDuration);
    session.lastActivityAt = now;
    session.isActive = true;

    this.logger.log(`Session refreshed: ${sessionId}`);

    return session;
  }

  /**
   * Destroy session
   */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Remove from user sessions
    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);

    this.logger.log(`Session destroyed: ${sessionId}`);

    return true;
  }

  /**
   * Destroy all sessions for user
   */
  destroyUserSessions(userId: string): number {
    const sessionIds = this.userSessions.get(userId);

    if (!sessionIds) {
      return 0;
    }

    let count = 0;
    for (const sessionId of Array.from(sessionIds)) {
      if (this.destroySession(sessionId)) {
        count++;
      }
    }

    this.logger.log(`Destroyed ${count} sessions for user ${userId}`);

    return count;
  }

  /**
   * Validate session
   */
  validateSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    return session !== undefined && session.isActive;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: Session): boolean {
    return Date.now() > session.expiresAt.getTime();
  }

  /**
   * Get oldest session for user
   */
  private getOldestSession(userId: string): string | undefined {
    const sessions = this.getUserSessions(userId);

    if (sessions.length === 0) {
      return undefined;
    }

    sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return sessions[0].id;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      // Check expiration
      if (this.isSessionExpired(session)) {
        this.destroySession(sessionId);
        cleaned++;
        continue;
      }

      // Check idle timeout
      const idleTime = now - session.lastActivityAt.getTime();
      if (idleTime > this.config.idleTimeout) {
        this.destroySession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Get session statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    totalUsers: number;
    averageSessionsPerUser: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  } {
    let activeSessions = 0;
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;

    for (const session of this.sessions.values()) {
      if (session.isActive && !this.isSessionExpired(session)) {
        activeSessions++;
      }

      if (!oldestSession || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }

      if (!newestSession || session.createdAt > newestSession) {
        newestSession = session.createdAt;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalUsers: this.userSessions.size,
      averageSessionsPerUser:
        this.userSessions.size > 0
          ? this.sessions.size / this.userSessions.size
          : 0,
      oldestSession,
      newestSession,
    };
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId: string): Partial<Session> | undefined {
    const session = this.getSession(sessionId);

    if (!session) {
      return undefined;
    }

    // Return safe session info (without sensitive data)
    return {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      ip: session.ip,
      isActive: session.isActive,
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set session metadata
   */
  setSessionMetadata(
    sessionId: string,
    key: string,
    value: unknown
  ): boolean {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.metadata[key] = value;
    return true;
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId: string, key: string): unknown {
    const session = this.sessions.get(sessionId);
    return session?.metadata[key];
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear();
    this.userSessions.clear();
    this.logger.warn('All sessions cleared');
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default SessionService;
