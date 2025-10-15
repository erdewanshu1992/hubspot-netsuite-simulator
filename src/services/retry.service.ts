import axios, { AxiosError, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: AxiosError) => boolean;
  onRetry?: (error: AxiosError, attempt: number) => void;
}

export interface RetryableOperation<T> {
  (): Promise<T>;
}

class RetryService {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryCondition: (error: AxiosError) => {
      // Retry on network errors, 5xx status codes, and specific 4xx errors
      return (
        axiosRetry.isNetworkError(error) ||
        axiosRetry.isRetryableError(error) ||
        error.response?.status === 429 || // Rate limiting
        error.response?.status === 408 || // Request timeout
        (error.response?.status || 0) >= 500
      );
    }
  };

  /**
   * Creates an axios instance with retry configuration
   */
  withAxiosRetry(instance = axios, config: RetryConfig = {}): any {
    const mergedConfig = { ...this.defaultConfig, ...config };

    axiosRetry(instance, {
      retries: mergedConfig.maxRetries,
      retryDelay: (retryCount: number, error: AxiosError) => {
        const delay = Math.min(
          mergedConfig.initialDelay! * Math.pow(mergedConfig.backoffMultiplier!, retryCount),
          mergedConfig.maxDelay!
        );

        if (mergedConfig.onRetry) {
          mergedConfig.onRetry(error, retryCount);
        }

        console.log(`Retrying request (attempt ${retryCount + 1}) after ${delay}ms delay`);
        return delay;
      },
      retryCondition: mergedConfig.retryCondition
    });

    return instance;
  }

  /**
   * Executes a retryable operation with exponential backoff
   */
  async executeWithRetry<T>(
    operation: RetryableOperation<T>,
    config: RetryConfig = {}
  ): Promise<T> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= (mergedConfig.maxRetries || 3); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (attempt < (mergedConfig.maxRetries || 3) &&
            mergedConfig.retryCondition!(error as AxiosError)) {

          const delay = Math.min(
            (mergedConfig.initialDelay || 1000) * Math.pow((mergedConfig.backoffMultiplier || 2), attempt),
            mergedConfig.maxDelay || 30000
          );

          if (mergedConfig.onRetry) {
            mergedConfig.onRetry(error as AxiosError, attempt + 1);
          }

          console.log(`Operation failed (attempt ${attempt + 1}), retrying in ${delay}ms...`, {
            error: (error as Error).message,
            attempt: attempt + 1,
            maxRetries: mergedConfig.maxRetries
          });

          await this.sleep(delay);
        } else {
          // No more retries or error is not retryable
          break;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Specialized retry for HubSpot API calls
   */
  async executeHubSpotOperation<T>(
    operation: RetryableOperation<T>,
    context?: string
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      retryCondition: (error: AxiosError) => {
        // HubSpot-specific retry conditions
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkError(error) ||
          status === 429 || // Rate limiting
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504
        );
      },
      onRetry: (error, attempt) => {
        console.log(`HubSpot API retry ${attempt} for ${context}:`, {
          status: error.response?.status,
          message: error.message
        });
      }
    });
  }

  /**
   * Specialized retry for NetSuite API calls
   */
  async executeNetSuiteOperation<T>(
    operation: RetryableOperation<T>,
    context?: string
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 60000,
      retryCondition: (error: AxiosError) => {
        // NetSuite-specific retry conditions
        const status = error.response?.status;
        return (
          axiosRetry.isNetworkError(error) ||
          status === 429 || // Rate limiting
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          status === 408 // Request timeout
        );
      },
      onRetry: (error, attempt) => {
        console.log(`NetSuite API retry ${attempt} for ${context}:`, {
          status: error.response?.status,
          message: error.message
        });
      }
    });
  }

  /**
   * Retry for webhook processing
   */
  async executeWebhookOperation<T>(
    operation: RetryableOperation<T>,
    webhookId: string
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      maxRetries: 2,
      initialDelay: 5000,
      maxDelay: 15000,
      retryCondition: (error: AxiosError) => {
        // More conservative retry for webhooks to avoid duplicate processing
        return (
          axiosRetry.isNetworkError(error) ||
          error.response?.status === 500 ||
          error.response?.status === 502 ||
          error.response?.status === 503
        );
      },
      onRetry: (error, attempt) => {
        console.log(`Webhook processing retry ${attempt} for ${webhookId}:`, {
          status: error.response?.status,
          message: error.message
        });
      }
    });
  }

  /**
   * Circuit breaker pattern for external services
   */
  private circuitBreakerStates: Map<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private lastFailureTimes: Map<string, number> = new Map();

  async executeWithCircuitBreaker<T>(
    operation: RetryableOperation<T>,
    serviceName: string,
    threshold: number = 5,
    timeout: number = 60000
  ): Promise<T> {
    const state = this.circuitBreakerStates.get(serviceName) || 'CLOSED';
    const failureCount = this.failureCounts.get(serviceName) || 0;
    const lastFailure = this.lastFailureTimes.get(serviceName) || 0;

    // Check if circuit breaker should transition from OPEN to HALF_OPEN
    if (state === 'OPEN' && Date.now() - lastFailure > timeout) {
      this.circuitBreakerStates.set(serviceName, 'HALF_OPEN');
      console.log(`Circuit breaker for ${serviceName} transitioning to HALF_OPEN`);
    }

    // Reject immediately if circuit is OPEN
    if (state === 'OPEN') {
      throw new Error(`Circuit breaker is OPEN for service ${serviceName}`);
    }

    try {
      const result = await operation();

      // Success: reset circuit breaker if it was HALF_OPEN
      if (state === 'HALF_OPEN') {
        this.circuitBreakerStates.set(serviceName, 'CLOSED');
        this.failureCounts.set(serviceName, 0);
        console.log(`Circuit breaker for ${serviceName} reset to CLOSED`);
      }

      return result;
    } catch (error) {
      // Track failures
      this.failureCounts.set(serviceName, failureCount + 1);
      this.lastFailureTimes.set(serviceName, Date.now());

      // Open circuit if threshold exceeded
      if (failureCount + 1 >= threshold) {
        this.circuitBreakerStates.set(serviceName, 'OPEN');
        console.log(`Circuit breaker for ${serviceName} opened after ${failureCount + 1} failures`);
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker status for a service
   */
  getCircuitBreakerStatus(serviceName: string): {
    state: string;
    failureCount: number;
    lastFailure?: number;
  } {
    return {
      state: this.circuitBreakerStates.get(serviceName) || 'CLOSED',
      failureCount: this.failureCounts.get(serviceName) || 0,
      lastFailure: this.lastFailureTimes.get(serviceName)
    };
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceName: string): void {
    this.circuitBreakerStates.set(serviceName, 'CLOSED');
    this.failureCounts.set(serviceName, 0);
    this.lastFailureTimes.delete(serviceName);
    console.log(`Circuit breaker for ${serviceName} manually reset`);
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Bulk retry for multiple operations
   */
  async executeBulkOperations<T>(
    operations: RetryableOperation<T>[],
    config: RetryConfig & { concurrency?: number } = {}
  ): Promise<T[]> {
    const { concurrency = 3, ...retryConfig } = config;
    const results: T[] = [];
    const errors: Error[] = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);

      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await this.executeWithRetry(operation, retryConfig);
          return { success: true, result, index: i + index };
        } catch (error) {
          return { success: false, error: error as Error, index: i + index };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results and errors
      batchResults.forEach((result, batchIndex) => {
        const globalIndex = i + batchIndex;
        if (result.success && result.result !== undefined) {
          results[globalIndex] = result.result;
        } else if (!result.success && result.error) {
          errors.push(result.error);
        }
      });
    }

    if (errors.length > 0) {
      console.warn(`Bulk operation completed with ${errors.length} errors out of ${operations.length} operations`);
    }

    return results;
  }
}

// Legacy function for backward compatibility
export function withAxiosRetry(instance = axios) {
  axiosRetry(instance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (err) => axiosRetry.isNetworkOrIdempotentRequestError(err) || (err.response?.status || 0) >= 500
  });
  return instance;
}

export default new RetryService();
