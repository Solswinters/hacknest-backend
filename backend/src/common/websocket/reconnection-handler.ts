/**
 * WebSocket Reconnection Handler - Automatic reconnection with exponential backoff
 * HIGH PRIORITY: Resilience improvements for real-time features
 */

import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

export interface ReconnectionConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export interface ConnectionState {
  isConnected: boolean;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  reconnectAttempts: number;
  totalReconnects: number;
}

export class ReconnectionHandler {
  private readonly logger = new Logger(ReconnectionHandler.name);
  private config: ReconnectionConfig;
  private state: Map<string, ConnectionState> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<ReconnectionConfig>) {
    this.config = {
      maxAttempts: config?.maxAttempts || 10,
      initialDelay: config?.initialDelay || 1000,
      maxDelay: config?.maxDelay || 30000,
      backoffMultiplier: config?.backoffMultiplier || 2,
      timeoutMs: config?.timeoutMs || 5000,
    };
  }

  /**
   * Handle new connection
   */
  handleConnect(socketId: string): void {
    const state = this.getState(socketId);

    state.isConnected = true;
    state.lastConnectedAt = new Date();

    if (state.reconnectAttempts > 0) {
      state.totalReconnects++;
      this.logger.log(
        `Client ${socketId} reconnected after ${state.reconnectAttempts} attempts`
      );
    }

    state.reconnectAttempts = 0;

    // Clear reconnect timer if exists
    this.clearReconnectTimer(socketId);
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(socketId: string, reason: string): void {
    const state = this.getState(socketId);

    state.isConnected = false;
    state.lastDisconnectedAt = new Date();

    this.logger.warn(`Client ${socketId} disconnected: ${reason}`);

    // Start reconnection if disconnect wasn't intentional
    if (this.shouldAttemptReconnect(reason)) {
      this.scheduleReconnect(socketId);
    }
  }

  /**
   * Check if should attempt reconnection
   */
  private shouldAttemptReconnect(reason: string): boolean {
    const noReconnectReasons = [
      'client namespace disconnect',
      'server namespace disconnect',
      'transport close',
    ];

    return !noReconnectReasons.includes(reason);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(socketId: string): void {
    const state = this.getState(socketId);

    if (state.reconnectAttempts >= this.config.maxAttempts) {
      this.logger.error(
        `Max reconnection attempts reached for client ${socketId}`
      );
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialDelay *
        Math.pow(this.config.backoffMultiplier, state.reconnectAttempts),
      this.config.maxDelay
    );

    this.logger.log(
      `Scheduling reconnect for ${socketId} in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${this.config.maxAttempts})`
    );

    const timer = setTimeout(() => {
      this.attemptReconnect(socketId);
    }, delay);

    this.reconnectTimers.set(socketId, timer);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(socketId: string): void {
    const state = this.getState(socketId);
    state.reconnectAttempts++;

    this.logger.log(
      `Attempting reconnect for ${socketId} (attempt ${state.reconnectAttempts})`
    );

    // The actual reconnection is handled by the client
    // Server just tracks the state and manages backoff
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(socketId: string): void {
    const timer = this.reconnectTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(socketId);
    }
  }

  /**
   * Get connection state
   */
  private getState(socketId: string): ConnectionState {
    if (!this.state.has(socketId)) {
      this.state.set(socketId, {
        isConnected: false,
        reconnectAttempts: 0,
        totalReconnects: 0,
      });
    }
    return this.state.get(socketId)!;
  }

  /**
   * Get public state
   */
  getConnectionState(socketId: string): ConnectionState {
    return { ...this.getState(socketId) };
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(socketId: string): boolean {
    const state = this.getState(socketId);

    if (!state.isConnected) return false;

    // Check if connection is recent
    if (state.lastConnectedAt) {
      const timeSinceConnect =
        Date.now() - state.lastConnectedAt.getTime();
      if (timeSinceConnect > this.config.timeoutMs) {
        return false;
      }
    }

    return true;
  }

  /**
   * Reset reconnection state
   */
  reset(socketId: string): void {
    this.clearReconnectTimer(socketId);
    this.state.delete(socketId);
  }

  /**
   * Get all connection states
   */
  getAllStates(): Map<string, ConnectionState> {
    return new Map(this.state);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalConnections: number;
    activeConnections: number;
    totalReconnects: number;
    averageReconnects: number;
  } {
    let activeConnections = 0;
    let totalReconnects = 0;

    for (const state of this.state.values()) {
      if (state.isConnected) {
        activeConnections++;
      }
      totalReconnects += state.totalReconnects;
    }

    return {
      totalConnections: this.state.size,
      activeConnections,
      totalReconnects,
      averageReconnects:
        this.state.size > 0 ? totalReconnects / this.state.size : 0,
    };
  }

  /**
   * Cleanup stale connections
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [socketId, state] of this.state.entries()) {
      if (!state.isConnected && state.lastDisconnectedAt) {
        const age = now - state.lastDisconnectedAt.getTime();
        if (age > maxAge) {
          toRemove.push(socketId);
        }
      }
    }

    for (const socketId of toRemove) {
      this.reset(socketId);
    }

    if (toRemove.length > 0) {
      this.logger.log(`Cleaned up ${toRemove.length} stale connections`);
    }
  }

  /**
   * Force reconnect for a client
   */
  forceReconnect(socketId: string): void {
    this.logger.log(`Forcing reconnect for ${socketId}`);
    const state = this.getState(socketId);
    state.reconnectAttempts = 0;
    this.scheduleReconnect(socketId);
  }

  /**
   * Get connection uptime
   */
  getUptime(socketId: string): number {
    const state = this.getState(socketId);

    if (!state.isConnected || !state.lastConnectedAt) {
      return 0;
    }

    return Date.now() - state.lastConnectedAt.getTime();
  }
}

export default ReconnectionHandler;

