/**
 * Error Codes - Standardized error codes for consistent error handling
 * HIGH PRIORITY: Security and error handling standardization
 */

export enum ErrorCode {
  // Authentication errors (1000-1099)
  AUTH_INVALID_CREDENTIALS = 'AUTH_1000',
  AUTH_TOKEN_EXPIRED = 'AUTH_1001',
  AUTH_TOKEN_INVALID = 'AUTH_1002',
  AUTH_UNAUTHORIZED = 'AUTH_1003',
  AUTH_FORBIDDEN = 'AUTH_1004',
  AUTH_ACCOUNT_LOCKED = 'AUTH_1005',
  AUTH_ACCOUNT_NOT_VERIFIED = 'AUTH_1006',

  // Validation errors (2000-2099)
  VALIDATION_FAILED = 'VAL_2000',
  VALIDATION_MISSING_FIELD = 'VAL_2001',
  VALIDATION_INVALID_FORMAT = 'VAL_2002',
  VALIDATION_OUT_OF_RANGE = 'VAL_2003',
  VALIDATION_DUPLICATE = 'VAL_2004',

  // Resource errors (3000-3099)
  RESOURCE_NOT_FOUND = 'RES_3000',
  RESOURCE_ALREADY_EXISTS = 'RES_3001',
  RESOURCE_CONFLICT = 'RES_3002',
  RESOURCE_DELETED = 'RES_3003',

  // Database errors (4000-4099)
  DB_CONNECTION_FAILED = 'DB_4000',
  DB_QUERY_FAILED = 'DB_4001',
  DB_TRANSACTION_FAILED = 'DB_4002',
  DB_CONSTRAINT_VIOLATION = 'DB_4003',

  // Web3 errors (5000-5099)
  WEB3_PROVIDER_ERROR = 'WEB3_5000',
  WEB3_TRANSACTION_FAILED = 'WEB3_5001',
  WEB3_SIGNATURE_INVALID = 'WEB3_5002',
  WEB3_NETWORK_ERROR = 'WEB3_5003',
  WEB3_INSUFFICIENT_FUNDS = 'WEB3_5004',

  // Rate limiting (6000-6099)
  RATE_LIMIT_EXCEEDED = 'RATE_6000',
  TOO_MANY_REQUESTS = 'RATE_6001',

  // Server errors (9000-9099)
  INTERNAL_SERVER_ERROR = 'SRV_9000',
  SERVICE_UNAVAILABLE = 'SRV_9001',
  EXTERNAL_SERVICE_ERROR = 'SRV_9002',
  TIMEOUT = 'SRV_9003',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials provided',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCode.AUTH_FORBIDDEN]: 'Access forbidden',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Account is locked',
  [ErrorCode.AUTH_ACCOUNT_NOT_VERIFIED]: 'Account not verified',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  [ErrorCode.VALIDATION_MISSING_FIELD]: 'Required field is missing',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format',
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value out of range',
  [ErrorCode.VALIDATION_DUPLICATE]: 'Duplicate entry',

  // Resources
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.RESOURCE_CONFLICT]: 'Resource conflict',
  [ErrorCode.RESOURCE_DELETED]: 'Resource has been deleted',

  // Database
  [ErrorCode.DB_CONNECTION_FAILED]: 'Database connection failed',
  [ErrorCode.DB_QUERY_FAILED]: 'Database query failed',
  [ErrorCode.DB_TRANSACTION_FAILED]: 'Database transaction failed',
  [ErrorCode.DB_CONSTRAINT_VIOLATION]: 'Database constraint violation',

  // Web3
  [ErrorCode.WEB3_PROVIDER_ERROR]: 'Web3 provider error',
  [ErrorCode.WEB3_TRANSACTION_FAILED]: 'Transaction failed',
  [ErrorCode.WEB3_SIGNATURE_INVALID]: 'Invalid signature',
  [ErrorCode.WEB3_NETWORK_ERROR]: 'Network error',
  [ErrorCode.WEB3_INSUFFICIENT_FUNDS]: 'Insufficient funds',

  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests',

  // Server
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCode.TIMEOUT]: 'Request timeout',
};

export const getErrorMessage = (code: ErrorCode): string => {
  return ErrorMessages[code] || 'Unknown error';
};

export const isAuthError = (code: ErrorCode): boolean => {
  return code.startsWith('AUTH_');
};

export const isValidationError = (code: ErrorCode): boolean => {
  return code.startsWith('VAL_');
};

export const isResourceError = (code: ErrorCode): boolean => {
  return code.startsWith('RES_');
};

export default { ErrorCode, ErrorMessages, getErrorMessage };

