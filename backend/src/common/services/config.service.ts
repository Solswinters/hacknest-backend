import { Injectable, Logger } from '@nestjs/common';

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    port: number;
    host: string;
    url: string;
  };
  database: {
    uri: string;
    name: string;
    options: Record<string, any>;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  web3: {
    providerUrl: string;
    chainId: number;
    privateKey?: string;
    contractAddresses: {
      prizePool?: string;
      gameToken?: string;
      achievements?: string;
    };
  };
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    uploadDir: string;
  };
  email: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    format: 'json' | 'simple';
    enabled: boolean;
  };
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): AppConfig {
    return {
      app: {
        name: process.env.APP_NAME || 'Hacknest',
        version: process.env.APP_VERSION || '1.0.0',
        environment: (process.env.NODE_ENV as any) || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || 'localhost',
        url: process.env.APP_URL || 'http://localhost:3000',
      },
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        name: process.env.DB_NAME || 'hacknest',
        options: {},
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
      web3: {
        providerUrl: process.env.WEB3_PROVIDER_URL || 'https://mainnet.base.org',
        chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
        privateKey: process.env.PRIVATE_KEY,
        contractAddresses: {
          prizePool: process.env.PRIZE_POOL_CONTRACT,
          gameToken: process.env.GAME_TOKEN_CONTRACT,
          achievements: process.env.ACHIEVEMENTS_CONTRACT,
        },
      },
      cors: {
        enabled: process.env.CORS_ENABLED === 'true',
        origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: process.env.CORS_CREDENTIALS === 'true',
      },
      rateLimit: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
      upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
        allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
          'image/jpeg',
          'image/png',
          'application/pdf',
        ],
        uploadDir: process.env.UPLOAD_DIR || './uploads',
      },
      email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || '',
          pass: process.env.EMAIL_PASS || '',
        },
        from: process.env.EMAIL_FROM || 'noreply@hacknest.io',
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        format: (process.env.LOG_FORMAT as any) || 'json',
        enabled: process.env.LOGGING_ENABLED !== 'false',
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const required = [
      { key: 'JWT_SECRET', value: this.config.jwt.secret },
      { key: 'MONGODB_URI', value: this.config.database.uri },
    ];

    for (const { key, value } of required) {
      if (!value || value === 'your-secret-key') {
        this.logger.warn(`${key} is not properly configured`);
      }
    }

    if (this.config.app.environment === 'production') {
      if (this.config.jwt.secret === 'your-secret-key') {
        throw new Error('JWT_SECRET must be set in production');
      }
    }

    this.logger.log('Configuration validated successfully');
  }

  /**
   * Get app configuration
   */
  getAppConfig(): AppConfig['app'] {
    return { ...this.config.app };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): AppConfig['database'] {
    return { ...this.config.database };
  }

  /**
   * Get JWT configuration
   */
  getJwtConfig(): AppConfig['jwt'] {
    return { ...this.config.jwt };
  }

  /**
   * Get Web3 configuration
   */
  getWeb3Config(): AppConfig['web3'] {
    return { ...this.config.web3 };
  }

  /**
   * Get CORS configuration
   */
  getCorsConfig(): AppConfig['cors'] {
    return { ...this.config.cors };
  }

  /**
   * Get rate limit configuration
   */
  getRateLimitConfig(): AppConfig['rateLimit'] {
    return { ...this.config.rateLimit };
  }

  /**
   * Get upload configuration
   */
  getUploadConfig(): AppConfig['upload'] {
    return { ...this.config.upload };
  }

  /**
   * Get email configuration
   */
  getEmailConfig(): AppConfig['email'] {
    return { ...this.config.email };
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): AppConfig['logging'] {
    return { ...this.config.logging };
  }

  /**
   * Get full configuration
   */
  getAllConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get specific config value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Check if in production
   */
  isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  /**
   * Check if in development
   */
  isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if in staging
   */
  isStaging(): boolean {
    return this.config.app.environment === 'staging';
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return this.config.app.environment;
  }

  /**
   * Update configuration (for testing)
   */
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Get contract address
   */
  getContractAddress(
    contract: keyof AppConfig['web3']['contractAddresses']
  ): string | undefined {
    return this.config.web3.contractAddresses[contract];
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: 'cors' | 'rateLimit' | 'email' | 'logging'): boolean {
    switch (feature) {
      case 'cors':
        return this.config.cors.enabled;
      case 'rateLimit':
        return this.config.rateLimit.enabled;
      case 'email':
        return this.config.email.enabled;
      case 'logging':
        return this.config.logging.enabled;
      default:
        return false;
    }
  }

  /**
   * Get database connection string
   */
  getDatabaseUri(): string {
    return `${this.config.database.uri}/${this.config.database.name}`;
  }

  /**
   * Get app URL
   */
  getAppUrl(): string {
    return this.config.app.url;
  }

  /**
   * Get port
   */
  getPort(): number {
    return this.config.app.port;
  }
}

export default ConfigService;

