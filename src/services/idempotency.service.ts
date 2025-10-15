import { v4 as uuidv4 } from 'uuid';
import { HubSpotWebhookEvent, ExpandedLineItemsHubSpotWebhookEvent } from '../types';
import redisCacheService from './redisCache.service';

export interface IdempotencyKey {
  key: string;
  expiresAt: number;
  operation: string;
  entityId: string;
  entityType: string;
}

export interface IdempotencyResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  isDuplicate: boolean;
  processedAt?: number;
}

class IdempotencyService {
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly MAX_TTL = 3600; // 1 hour

  /**
   * Generates a unique idempotency key for an operation
   */
  generateIdempotencyKey(
    operation: string,
    entityType: string,
    entityId: string,
    additionalData?: any
  ): string {
    const uniqueId = uuidv4();
    const baseKey = `${operation}:${entityType}:${entityId}`;

    if (additionalData) {
      // Create a hash of additional data for the key
      const dataHash = this.hashData(additionalData);
      return `${baseKey}:${dataHash}:${uniqueId}`;
    }

    return `${baseKey}:${uniqueId}`;
  }

  /**
   * Generates an idempotency key for webhook events
   */
  generateWebhookIdempotencyKey(event: HubSpotWebhookEvent): string {
    const { objectId, objectType, subscriptionType, occurredAt, propertyName, propertyValue } = event;

    // Create a deterministic key based on event characteristics
    const eventSignature = `${objectType}:${subscriptionType}:${objectId}:${occurredAt}:${propertyName || ''}:${propertyValue || ''}`;

    return `webhook:${this.hashData(eventSignature)}`;
  }

  /**
   * Checks if an operation has already been processed
   */
  async checkIdempotency<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    try {
      // Check if operation is already in progress or completed
      const existingResult = await redisCacheService.getClient().get(`idempotency:${key}`);

      if (existingResult) {
        const parsed = JSON.parse(existingResult);

        if (parsed.status === 'processing') {
          // Operation is currently being processed
          return {
            success: false,
            error: 'Operation is already being processed',
            isDuplicate: true,
            processedAt: parsed.startedAt
          };
        } else if (parsed.status === 'completed') {
          // Operation was already completed successfully
          return {
            success: true,
            result: parsed.result,
            isDuplicate: true,
            processedAt: parsed.completedAt
          };
        } else if (parsed.status === 'failed') {
          // Operation failed previously, but we can retry
          console.log(`Previous operation failed, retrying: ${parsed.error}`);
        }
      }

      // Mark operation as in progress
      await this.markOperationInProgress(key);

      try {
        // Execute the operation
        const result = await operation();

        // Mark operation as completed
        await this.markOperationCompleted(key, result);

        return {
          success: true,
          result,
          isDuplicate: false
        };

      } catch (error) {
        // Mark operation as failed
        await this.markOperationFailed(key, error as Error);

        return {
          success: false,
          error: (error as Error).message,
          isDuplicate: false
        };
      }

    } catch (error) {
      console.error('Idempotency check failed:', error);
      // If idempotency check fails, proceed with operation but log warning
      try {
        const result = await operation();
        return {
          success: true,
          result,
          isDuplicate: false
        };
      } catch (operationError) {
        return {
          success: false,
          error: (operationError as Error).message,
          isDuplicate: false
        };
      }
    }
  }

  /**
   * Processes a webhook event with idempotency protection
   */
  async processWebhookWithIdempotency<T>(
    event: HubSpotWebhookEvent,
    operation: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    const idempotencyKey = this.generateWebhookIdempotencyKey(event);

    return this.checkIdempotency(idempotencyKey, operation);
  }

  /**
   * Processes a deal operation with idempotency protection
   */
  async processDealOperationWithIdempotency<T>(
    dealId: string,
    operation: string,
    operationFn: () => Promise<T>,
    additionalData?: any
  ): Promise<IdempotencyResult<T>> {
    const idempotencyKey = this.generateIdempotencyKey(operation, 'deal', dealId, additionalData);

    return this.checkIdempotency(idempotencyKey, operationFn);
  }

  /**
   * Processes a line item operation with idempotency protection
   */
  async processLineItemOperationWithIdempotency<T>(
    lineItemId: string,
    operation: string,
    operationFn: () => Promise<T>,
    additionalData?: any
  ): Promise<IdempotencyResult<T>> {
    const idempotencyKey = this.generateIdempotencyKey(operation, 'lineItem', lineItemId, additionalData);

    return this.checkIdempotency(idempotencyKey, operationFn);
  }

  /**
   * Marks an operation as in progress
   */
  private async markOperationInProgress(key: string): Promise<void> {
    const idempotencyData = {
      status: 'processing',
      startedAt: Date.now(),
      key
    };

    await redisCacheService.getClient().setex(
      `idempotency:${key}`,
      this.DEFAULT_TTL,
      JSON.stringify(idempotencyData)
    );
  }

  /**
   * Marks an operation as completed successfully
   */
  private async markOperationCompleted<T>(key: string, result: T): Promise<void> {
    const idempotencyData = {
      status: 'completed',
      result,
      completedAt: Date.now(),
      key
    };

    await redisCacheService.getClient().setex(
      `idempotency:${key}`,
      this.DEFAULT_TTL,
      JSON.stringify(idempotencyData)
    );
  }

  /**
   * Marks an operation as failed
   */
  private async markOperationFailed(key: string, error: Error): Promise<void> {
    const idempotencyData = {
      status: 'failed',
      error: error.message,
      failedAt: Date.now(),
      key
    };

    // Keep failed operations for a shorter time
    await redisCacheService.getClient().setex(
      `idempotency:${key}`,
      60, // 1 minute for failed operations
      JSON.stringify(idempotencyData)
    );
  }

  /**
   * Cleans up expired idempotency keys
   */
  async cleanupExpiredIdempotencyKeys(): Promise<number> {
    try {
      // This is a simple cleanup - in production you might want more sophisticated cleanup
      const pattern = 'idempotency:*';
      const keys = await redisCacheService.getClient().keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys (they should have TTL, but this ensures cleanup)
      await redisCacheService.getClient().del(...keys);

      console.log(`Cleaned up ${keys.length} expired idempotency keys`);
      return keys.length;

    } catch (error) {
      console.error('Error cleaning up idempotency keys:', error);
      return 0;
    }
  }

  /**
   * Gets statistics about idempotency operations
   */
  async getIdempotencyStats(): Promise<{
    totalOperations: number;
    processingOperations: number;
    completedOperations: number;
    failedOperations: number;
  }> {
    try {
      const pattern = 'idempotency:*';
      const keys = await redisCacheService.getClient().keys(pattern);

      let processingCount = 0;
      let completedCount = 0;
      let failedCount = 0;

      for (const key of keys) {
        const data = await redisCacheService.getClient().get(key);
        if (data) {
          const parsed = JSON.parse(data);
          switch (parsed.status) {
            case 'processing':
              processingCount++;
              break;
            case 'completed':
              completedCount++;
              break;
            case 'failed':
              failedCount++;
              break;
          }
        }
      }

      return {
        totalOperations: keys.length,
        processingOperations: processingCount,
        completedOperations: completedCount,
        failedOperations: failedCount
      };

    } catch (error) {
      console.error('Error getting idempotency stats:', error);
      return {
        totalOperations: 0,
        processingOperations: 0,
        completedOperations: 0,
        failedOperations: 0
      };
    }
  }

  /**
   * Forces completion of a stuck operation (use with caution)
   */
  async forceCompleteOperation(key: string, result: any): Promise<boolean> {
    try {
      await this.markOperationCompleted(key, result);
      console.log(`Force completed idempotency operation: ${key}`);
      return true;
    } catch (error) {
      console.error(`Error force completing operation ${key}:`, error);
      return false;
    }
  }

  /**
   * Cancels a processing operation (use with caution)
   */
  async cancelProcessingOperation(key: string): Promise<boolean> {
    try {
      await redisCacheService.getClient().del(`idempotency:${key}`);
      console.log(`Cancelled processing operation: ${key}`);
      return true;
    } catch (error) {
      console.error(`Error cancelling operation ${key}:`, error);
      return false;
    }
  }

  /**
   * Creates a hash of data for deterministic key generation
   */
  private hashData(data: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex').substring(0, 8);
  }

  /**
   * Validates if an idempotency key is well-formed
   */
  validateIdempotencyKey(key: string): boolean {
    // Basic validation - ensure key follows expected pattern
    return key.length > 0 && !key.includes('..') && !key.startsWith(':') && !key.endsWith(':');
  }

  /**
   * Gets detailed information about an idempotency operation
   */
  async getIdempotencyOperationInfo(key: string): Promise<{
    exists: boolean;
    status?: string;
    startedAt?: number;
    completedAt?: number;
    failedAt?: number;
    error?: string;
    result?: any;
  } | null> {
    try {
      const data = await redisCacheService.getClient().get(`idempotency:${key}`);

      if (!data) {
        return { exists: false };
      }

      const parsed = JSON.parse(data);
      return {
        exists: true,
        status: parsed.status,
        startedAt: parsed.startedAt,
        completedAt: parsed.completedAt,
        failedAt: parsed.failedAt,
        error: parsed.error,
        result: parsed.result
      };

    } catch (error) {
      console.error(`Error getting idempotency operation info for ${key}:`, error);
      return null;
    }
  }
}

export default new IdempotencyService();
