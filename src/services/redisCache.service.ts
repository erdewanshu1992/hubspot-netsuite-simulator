import Redis from 'ioredis';
import { ENV } from '../config/env';
import { ExpandedLineItemsHubSpotWebhookEvent, HubSpotWebhookEvent } from '../types';

class RedisCacheService {
  private client: Redis;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 2; // Limit to 2 attempts as requested

  constructor() {
    this.client = new Redis(ENV.REDIS_URL, {
      password: ENV.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2, // Limit to 2 retries as requested
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
      retryDelayOnFailover: 100
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isConnected = true;
      this.connectionAttempts = 0; // Reset counter on successful connection
    });

    this.client.on('error', (error) => {
      this.connectionAttempts++;
      console.error(`Redis connection error (attempt ${this.connectionAttempts}):`, error);
      this.isConnected = false;

      // Don't retry if we've exceeded max attempts
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error('Max Redis connection attempts reached, giving up');
      }
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
      this.isConnected = false;
    });

    // Don't auto-connect in constructor for testing
    if (process.env.NODE_ENV !== 'test') {
      this.connect();
    }
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log('Max connection attempts reached, skipping connection');
      return;
    }

    try {
      this.connectionAttempts++;
      await this.client.connect();
    } catch (error) {
      console.error(`Failed to connect to Redis (attempt ${this.connectionAttempts}):`, error);
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        // Retry after delay
        setTimeout(() => this.connect(), 1000);
      }
    }
  }

  /**
   * Connect to Redis (public method for testing)
   */
  public async connectForTesting(): Promise<void> {
    await this.connect();
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Save a webhook request to cache for deduplication
   */
  async saveRequestToCache(
    event: ExpandedLineItemsHubSpotWebhookEvent | HubSpotWebhookEvent,
    key: string,
    source: string,
    hsId: string,
    hsProperty?: string,
    hsValue?: string,
    entityType?: string,
    nsProperty?: string
  ): Promise<void> {
    if (!this.isReady()) {
      console.warn('Redis not connected, skipping cache save');
      return;
    }

    try {
      const cacheData = {
        event,
        source,
        hsId,
        hsProperty,
        hsValue,
        entityType,
        nsProperty,
        timestamp: Date.now()
      };

      // Set cache with expiration (default 30 seconds for webhook deduplication)
      const expirationTime = source === 'itemPropChange' ? 30 : 60;
      await this.client.setex(`webhook:${key}`, expirationTime, JSON.stringify(cacheData));

      console.log(`Saved request to cache: ${key}`);
    } catch (error) {
      console.error('Error saving request to cache:', error);
    }
  }

  /**
   * Get a request from cache
   */
  async getRequestFromCache(
    key: string,
    source: string,
    hsId: string,
    hsProperty?: string,
    hsValue?: string,
    entityType?: string,
    nsProperty?: string
  ): Promise<ExpandedLineItemsHubSpotWebhookEvent | HubSpotWebhookEvent | null> {
    if (!this.isReady()) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const cachedData = await this.client.get(`webhook:${key}`);

      if (!cachedData) {
        return null;
      }

      const parsedData = JSON.parse(cachedData);

      // Verify the cached request matches our criteria
      if (parsedData.hsId === hsId &&
          parsedData.hsProperty === hsProperty &&
          parsedData.hsValue === hsValue &&
          parsedData.entityType === entityType &&
          parsedData.nsProperty === nsProperty) {
        return parsedData.event;
      }

      return null;
    } catch (error) {
      console.error('Error getting request from cache:', error);
      return null;
    }
  }

  /**
   * Delete a request from cache
   */
  async deleteRequestFromCache(
    key: string,
    source: string,
    hsId: string,
    hsProperty?: string,
    hsValue?: string,
    entityType?: string,
    nsProperty?: string
  ): Promise<void> {
    if (!this.isReady()) {
      console.warn('Redis not connected, skipping cache delete');
      return;
    }

    try {
      await this.client.del(`webhook:${key}`);
      console.log(`Deleted request from cache: ${key}`);
    } catch (error) {
      console.error('Error deleting request from cache:', error);
    }
  }

  /**
   * Check cache status for webhook deduplication
   */
  async checkCacheStatus(
    event: ExpandedLineItemsHubSpotWebhookEvent,
    hsId: string,
    hsProperty: string,
    hsValue: string,
    nsProperty: string,
    source: string
  ): Promise<boolean> {
    const key = `${hsId}-${hsProperty}`;

    try {
      const storedRequest = await this.getRequestFromCache(
        key, source, hsId, hsProperty, hsValue, 'opportunity', nsProperty
      );

      if (storedRequest) {
        // If stored request is older than current request, delete old and allow new
        if (event.occurredAt > storedRequest.occurredAt) {
          await this.deleteRequestFromCache(
            key, source, hsId, hsProperty, hsValue, 'opportunity', nsProperty
          );
          console.log('Incoming request newer than cached request. Allowing processing.');
          return true;
        } else {
          // Current request is older or same, skip processing
          console.log('Request already processed or older request exists in cache');
          return false;
        }
      }

      // No cached request found, allow processing
      return true;
    } catch (error) {
      console.error('Error checking cache status:', error);
      // On error, allow processing to be safe
      return true;
    }
  }

  /**
   * Store Mohave price change event for tracking
   */
  async storeMohavePriceChange(itemId: string): Promise<void> {
    if (!this.isReady()) {
      console.warn('Redis not connected, skipping Mohave price change storage');
      return;
    }

    try {
      const key = `mohavePriceChange:${itemId}`;
      await this.client.setex(key, 10, 'PROCESSING'); // Expire after 10 seconds
      console.log(`Stored Mohave price change for item ${itemId}`);
    } catch (error) {
      console.error('Error storing Mohave price change:', error);
    }
  }

  /**
   * Check if Mohave price change is in progress
   */
  async checkMohavePriceChange(itemId: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const key = `mohavePriceChange:${itemId}`;
      const result = await this.client.get(key);
      return result === 'PROCESSING';
    } catch (error) {
      console.error('Error checking Mohave price change:', error);
      return false;
    }
  }

  /**
   * Clear Mohave price change flag
   */
  async clearMohavePriceChange(itemId: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    try {
      const key = `mohavePriceChange:${itemId}`;
      await this.client.del(key);
      console.log(`Cleared Mohave price change flag for item ${itemId}`);
    } catch (error) {
      console.error('Error clearing Mohave price change:', error);
    }
  }

  /**
   * Store processing delay for rate limiting
   */
  async setProcessingDelay(key: string, delayMs: number): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    try {
      await this.client.setex(`delay:${key}`, Math.ceil(delayMs / 1000), '1');
    } catch (error) {
      console.error('Error setting processing delay:', error);
    }
  }

  /**
   * Check if processing delay is active
   */
  async checkProcessingDelay(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client.get(`delay:${key}`);
      return result === '1';
    } catch (error) {
      console.error('Error checking processing delay:', error);
      return false;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    try {
      // This is a simple cleanup - in production you might want more sophisticated cleanup
      const pattern = 'webhook:*';
      const keys = await this.client.keys(pattern);

      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -1) {
          // Key has no expiration, set one
          await this.client.expire(key, 300); // 5 minutes default
        }
      }

      console.log(`Cleaned up ${keys.length} cache entries`);
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage?: string;
  }> {
    if (!this.isReady()) {
      return { connected: false, keyCount: 0 };
    }

    try {
      const keyCount = await this.client.dbsize();
      const info = await this.client.info('memory');
      const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1] || 'unknown';

      return {
        connected: true,
        keyCount,
        memoryUsage
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { connected: false, keyCount: 0 };
    }
  }

  /**
   * Execute raw Redis command for advanced operations
   */
  async executeRawCommand<T>(command: string, ...args: any[]): Promise<T> {
    return await (this.client as any).call(command, ...args);
  }

  /**
   * Get Redis client instance for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        await this.client.quit();
      }
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }

  /**
   * Disconnect Redis connection (for testing)
   */
  async disconnectForTesting(): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        await this.client.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting Redis for testing:', error);
    }
  }
}

// Create singleton instance
const redisCacheService = new RedisCacheService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing Redis connection...');
  await redisCacheService.close();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing Redis connection...');
  await redisCacheService.close();
});

export default redisCacheService;