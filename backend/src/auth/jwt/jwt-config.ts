/**
 * JWT Configuration - Enhanced JWT configuration with security best practices
 * HIGH PRIORITY: Security improvements for token management
 */

export interface JwtConfig {
  secret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

export interface JwtPayload {
  sub: string; // Subject (user address)
  role: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
  iss?: string; // Issuer
  aud?: string; // Audience
  jti?: string; // JWT ID for revocation
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
  jti?: string;
}

export const getJwtConfig = (): JwtConfig => {
  return {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'hacknest-api',
    audience: process.env.JWT_AUDIENCE || 'hacknest-client',
    algorithm: (process.env.JWT_ALGORITHM as any) || 'HS256',
  };
};

export const JWT_CONSTANTS = {
  ACCESS_TOKEN_TYPE: 'access',
  REFRESH_TOKEN_TYPE: 'refresh',
  TOKEN_HEADER: 'authorization',
  TOKEN_PREFIX: 'Bearer ',
} as const;

export default { getJwtConfig, JWT_CONSTANTS };

