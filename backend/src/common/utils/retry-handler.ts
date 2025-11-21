/**
 * Retry Handler - Intelligent retry logic for failed operations
 * Improves system resilience and handles transient failures
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export class RetryHandler {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig: RetryConfig = { ...this.DEFAULT_CONFIG, ...config };

    let lastError: Error | undefined;
    let attempt = 0;
    let delay = finalConfig.initialDelay;

    while (attempt < finalConfig.maxAttempts) {
      attempt++;

      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (
          finalConfig.retryableErrors &&
          !this.isRetryableError(error as Error, finalConfig.retryableErrors)
        ) {
          throw error;
        }

        // Last attempt, throw error
        if (attempt >= finalConfig.maxAttempts) {
          throw error;
        }

        // Call retry callback
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt, error as Error);
        }

        // Wait before retry
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(
          delay * finalConfig.backoffMultiplier,
          finalConfig.maxDelay
        );
      }
    }

    throw lastError;
  }

  /**
   * Execute with detailed result
   */
  static async executeWithResult<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const finalConfig: RetryConfig = { ...this.DEFAULT_CONFIG, ...config };

    let attempts = 0;

    try {
      const result = await this.execute(fn, {
        ...finalConfig,
        onRetry: (attempt, error) => {
          attempts = attempt;
          if (finalConfig.onRetry) {
            finalConfig.onRetry(attempt, error);
          }
        },
      });

      return {
        success: true,
        result,
        attempts: attempts + 1,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts: finalConfig.maxAttempts,
        totalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error, retryableErrors: string[]): boolean {
    return retryableErrors.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Sleep for specified duration
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry with exponential backoff and jitter
   */
  static async executeWithJitter<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig: RetryConfig = { ...this.DEFAULT_CONFIG, ...config };

    let lastError: Error | undefined;
    let attempt = 0;
    let delay = finalConfig.initialDelay;

    while (attempt < finalConfig.maxAttempts) {
      attempt++;

      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt >= finalConfig.maxAttempts) {
          throw error;
        }

        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt, error as Error);
        }

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        const delayWithJitter = delay + jitter;

        await this.sleep(delayWithJitter);

        delay = Math.min(
          delay * finalConfig.backoffMultiplier,
          finalConfig.maxDelay
        );
      }
    }

    throw lastError;
  }

  /**
   * Retry only on specific error types
   */
  static async retryOnError<T>(
    fn: () => Promise<T>,
    errorTypes: Array<new (...args: any[]) => Error>,
    maxAttempts = 3
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error type is in the list
        const shouldRetry = errorTypes.some(
          (ErrorType) => error instanceof ErrorType
        );

        if (!shouldRetry || attempt >= maxAttempts) {
          throw error;
        }

        await this.sleep(1000 * attempt);
      }
    }

    throw lastError;
  }

  /**
   * Retry with circuit breaker pattern
   */
  static createCircuitBreaker<T>(
    fn: () => Promise<T>,
    threshold = 5,
    timeout = 60000
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async (): Promise<T> => {
      // Check if circuit is open
      if (isOpen) {
        const timeSinceFailure = Date.now() - lastFailureTime;

        if (timeSinceFailure < timeout) {
          throw new Error('Circuit breaker is open');
        }

        // Try to close circuit
        isOpen = false;
        failures = 0;
      }

      try {
        const result = await fn();

        // Success - reset failures
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        if (failures >= threshold) {
          isOpen = true;
        }

        throw error;
      }
    };
  }
}

export default RetryHandler;

