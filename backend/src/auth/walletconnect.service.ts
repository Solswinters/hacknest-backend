import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';

export interface WalletConnectSession {
  topic: string;
  pairingTopic: string;
  relay: {
    protocol: string;
  };
  expiry: number;
  acknowledged: boolean;
  controller: string;
  namespaces: SessionTypes.Namespaces;
  requiredNamespaces: any;
  optionalNamespaces?: any;
  sessionProperties?: any;
  self: {
    publicKey: string;
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
  peer: {
    publicKey: string;
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
}

@Injectable()
export class WalletConnectService implements OnModuleInit {
  private readonly logger = new Logger(WalletConnectService.name);
  private client: SignClient | null = null;
  private readonly projectId: string;

  constructor() {
    this.projectId = process.env.WALLETCONNECT_PROJECT_ID || '';
  }

  async onModuleInit() {
    // Only initialize if PROJECT_ID is configured
    if (!this.projectId) {
      this.logger.warn(
        'WalletConnect PROJECT_ID not configured. Session management features disabled.',
      );
      this.logger.warn(
        'Get your Project ID from https://cloud.reown.com',
      );
      return;
    }

    try {
      this.client = await SignClient.init({
        projectId: this.projectId,
        metadata: {
          name: 'Hacknest Backend',
          description: 'Hacknest - Web3-native hackathon platform',
          url: process.env.APP_URL || 'https://hacknest.io',
          icons: [`${process.env.APP_URL || 'https://hacknest.io'}/icon.png`],
        },
      });

      this.logger.log('WalletConnect client initialized successfully');
      this.setupEventListeners();
    } catch (error) {
      this.logger.error('Failed to initialize WalletConnect client:', error);
    }
  }

  /**
   * Setup event listeners for session monitoring
   */
  private setupEventListeners() {
    if (!this.client) return;

    // Session proposal
    this.client.on('session_proposal', (event) => {
      this.logger.log(`Session proposal received: ${event.id}`);
    });

    // Session created
    this.client.on('session_event', (event) => {
      this.logger.log(`Session event: ${JSON.stringify(event)}`);
    });

    // Session updated
    this.client.on('session_update', ({ topic, params }) => {
      this.logger.log(`Session updated: ${topic}`);
      this.logger.debug(`Update params: ${JSON.stringify(params)}`);
    });

    // Session deleted
    this.client.on('session_delete', ({ topic }) => {
      this.logger.log(`Session deleted: ${topic}`);
    });

    // Session expired
    this.client.on('session_expire', ({ topic }) => {
      this.logger.log(`Session expired: ${topic}`);
    });

    // Session ping
    this.client.on('session_ping', ({ topic }) => {
      this.logger.debug(`Session ping: ${topic}`);
    });

    this.logger.log('WalletConnect event listeners configured');
  }

  /**
   * Check if WalletConnect is enabled
   */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Get a specific session by topic
   */
  async getSession(topic: string): Promise<WalletConnectSession | null> {
    if (!this.client) {
      this.logger.warn('WalletConnect not initialized');
      return null;
    }

    try {
      const session = this.client.session.get(topic);
      return session as WalletConnectSession;
    } catch (error) {
      this.logger.error(`Failed to get session ${topic}:`, error);
      return null;
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WalletConnectSession[] {
    if (!this.client) {
      this.logger.warn('WalletConnect not initialized');
      return [];
    }

    try {
      return this.client.session.getAll() as WalletConnectSession[];
    } catch (error) {
      this.logger.error('Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Get sessions for a specific wallet address
   */
  getSessionsByAddress(address: string): WalletConnectSession[] {
    const sessions = this.getActiveSessions();
    const normalizedAddress = address.toLowerCase();

    return sessions.filter((session) => {
      // Check if address exists in any namespace accounts
      const accounts = Object.values(session.namespaces)
        .flatMap((ns) => ns.accounts)
        .map((account) => {
          // Format: "eip155:1:0xabc..." -> "0xabc..."
          const parts = account.split(':');
          return parts[parts.length - 1]?.toLowerCase();
        });

      return accounts.includes(normalizedAddress);
    });
  }

  /**
   * Disconnect a specific session
   */
  async disconnectSession(topic: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('WalletConnect not initialized');
      return false;
    }

    try {
      await this.client.disconnect({
        topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });

      this.logger.log(`Session disconnected: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to disconnect session ${topic}:`, error);
      return false;
    }
  }

  /**
   * Ping a session to check if it's alive
   */
  async pingSession(topic: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('WalletConnect not initialized');
      return false;
    }

    try {
      await this.client.ping({ topic });
      this.logger.debug(`Session ping successful: ${topic}`);
      return true;
    } catch (error) {
      this.logger.error(`Session ping failed for ${topic}:`, error);
      return false;
    }
  }

  /**
   * Get session statistics for monitoring
   */
  getSessionStats() {
    const sessions = this.getActiveSessions();

    const now = Date.now() / 1000; // Convert to seconds

    return {
      total: sessions.length,
      active: sessions.filter((s) => s.expiry > now).length,
      expired: sessions.filter((s) => s.expiry <= now).length,
      acknowledged: sessions.filter((s) => s.acknowledged).length,
      byWallet: this.groupSessionsByWallet(sessions),
      byNamespace: this.groupSessionsByNamespace(sessions),
    };
  }

  /**
   * Group sessions by wallet (peer metadata)
   */
  private groupSessionsByWallet(sessions: WalletConnectSession[]) {
    const grouped: Record<string, number> = {};

    sessions.forEach((session) => {
      const walletName = session.peer.metadata.name || 'Unknown';
      grouped[walletName] = (grouped[walletName] || 0) + 1;
    });

    return grouped;
  }

  /**
   * Group sessions by blockchain namespace
   */
  private groupSessionsByNamespace(sessions: WalletConnectSession[]) {
    const grouped: Record<string, number> = {};

    sessions.forEach((session) => {
      Object.keys(session.namespaces).forEach((namespace) => {
        grouped[namespace] = (grouped[namespace] || 0) + 1;
      });
    });

    return grouped;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.client) {
      return 0;
    }

    const sessions = this.getActiveSessions();
    const now = Date.now() / 1000;
    let cleaned = 0;

    for (const session of sessions) {
      if (session.expiry <= now) {
        try {
          await this.disconnectSession(session.topic);
          cleaned++;
        } catch (error) {
          this.logger.error(`Failed to cleanup session ${session.topic}`, error);
        }
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired session(s)`);
    }

    return cleaned;
  }

  /**
   * Extract wallet addresses from a session
   */
  getAddressesFromSession(session: WalletConnectSession): string[] {
    const addresses: string[] = [];

    Object.values(session.namespaces).forEach((namespace) => {
      namespace.accounts.forEach((account) => {
        // Format: "eip155:1:0xabc..." -> "0xabc..."
        const parts = account.split(':');
        const address = parts[parts.length - 1];
        if (address && address.startsWith('0x')) {
          addresses.push(address.toLowerCase());
        }
      });
    });

    return [...new Set(addresses)]; // Remove duplicates
  }

  /**
   * Verify if a session contains a specific address
   */
  async verifySessionForAddress(
    topic: string,
    address: string,
  ): Promise<boolean> {
    const session = await this.getSession(topic);
    if (!session) return false;

    const addresses = this.getAddressesFromSession(session);
    return addresses.includes(address.toLowerCase());
  }
}

