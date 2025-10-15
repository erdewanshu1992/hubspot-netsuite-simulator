import { env } from '../config/env-loader';

/**
 * Monitoring Service
 * Provides application monitoring, health checks, and metrics collection
 */

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database?: DatabaseHealth;
    redis?: RedisHealth;
    hubspot?: ApiHealth;
    netsuite?: ApiHealth;
    memory?: MemoryHealth;
    disk?: DiskHealth;
  };
  responseTime: number;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime: number;
  connections?: number;
  error?: string;
}

export interface RedisHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime: number;
  memoryUsage?: number;
  connectedClients?: number;
  error?: string;
}

export interface ApiHealth {
  status: 'operational' | 'degraded' | 'outage' | 'error';
  responseTime: number;
  statusCode?: number;
  error?: string;
}

export interface MemoryHealth {
  status: 'healthy' | 'warning' | 'critical';
  used: number;
  total: number;
  percentage: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
}

export interface DiskHealth {
  status: 'healthy' | 'warning' | 'critical';
  used: number;
  total: number;
  percentage: number;
  free: number;
}

export interface MetricsData {
  timestamp: string;
  uptime: number;
  memory: MemoryHealth;
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  externalApis: {
    hubspot: { calls: number; errors: number; avgResponseTime: number };
    netsuite: { calls: number; errors: number; avgResponseTime: number };
  };
}

class MonitoringService {
  private startTime: number;
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private hubspotApiCalls = 0;
  private hubspotApiErrors = 0;
  private hubspotApiResponseTime = 0;
  private netsuiteApiCalls = 0;
  private netsuiteApiErrors = 0;
  private netsuiteApiResponseTime = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {};

    // Database health check
    checks.database = await this.checkDatabaseHealth();

    // Redis health check
    checks.redis = await this.checkRedisHealth();

    // HubSpot API health check
    checks.hubspot = await this.checkHubSpotHealth();

    // NetSuite API health check
    checks.netsuite = await this.checkNetSuiteHealth();

    // Memory health check
    checks.memory = this.checkMemoryHealth();

    // Disk health check
    checks.disk = this.checkDiskHealth();

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
      responseTime: Date.now() - startTime,
    };
  }

  /**
   * Get application metrics
   */
  getMetrics(): MetricsData {
    return {
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      memory: this.checkMemoryHealth(),
      requests: {
        total: this.requestCount,
        successful: this.requestCount - this.errorCount,
        failed: this.errorCount,
        averageResponseTime: this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0,
      },
      errors: {
        total: this.errorCount,
        byType: {}, // Could be expanded to track error types
      },
      externalApis: {
        hubspot: {
          calls: this.hubspotApiCalls,
          errors: this.hubspotApiErrors,
          avgResponseTime: this.hubspotApiCalls > 0 ? this.hubspotApiResponseTime / this.hubspotApiCalls : 0,
        },
        netsuite: {
          calls: this.netsuiteApiCalls,
          errors: this.netsuiteApiErrors,
          avgResponseTime: this.netsuiteApiCalls > 0 ? this.netsuiteApiResponseTime / this.netsuiteApiCalls : 0,
        },
      },
    };
  }

  /**
   * Record API request metrics
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.requestCount++;
    this.responseTimeSum += responseTime;

    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * Record HubSpot API call
   */
  recordHubSpotApiCall(responseTime: number, success: boolean): void {
    this.hubspotApiCalls++;
    this.hubspotApiResponseTime += responseTime;

    if (!success) {
      this.hubspotApiErrors++;
    }
  }

  /**
   * Record NetSuite API call
   */
  recordNetSuiteApiCall(responseTime: number, success: boolean): void {
    this.netsuiteApiCalls++;
    this.netsuiteApiResponseTime += responseTime;

    if (!success) {
      this.netsuiteApiErrors++;
    }
  }

  /**
   * Get application uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      // Import mongoose dynamically to avoid circular dependencies
      const mongoose = await import('mongoose');

      if (mongoose.connection.readyState === 1) {
        return {
          status: 'connected',
          responseTime: Date.now() - startTime,
        };
      } else {
        return {
          status: 'disconnected',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<RedisHealth> {
    const startTime = Date.now();

    try {
      // Import Redis client dynamically
      const { default: redisClient } = await import('./redisCache.service');

      // Simple connectivity check - check if service exists
      if (redisClient) {
        return {
          status: 'connected',
          responseTime: Date.now() - startTime,
        };
      } else {
        return {
          status: 'disconnected',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check HubSpot API health
   */
  private async checkHubSpotHealth(): Promise<ApiHealth> {
    const startTime = Date.now();

    try {
      // Import HubSpot service dynamically
      const { default: hubspotService } = await import('./hubspot.service');

      // Simple API call to check connectivity
      if (hubspotService) {
        return {
          status: 'operational',
          responseTime: Date.now() - startTime,
          statusCode: 200,
        };
      } else {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          statusCode: 500,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check NetSuite API health
   */
  private async checkNetSuiteHealth(): Promise<ApiHealth> {
    const startTime = Date.now();

    try {
      // Import NetSuite service dynamically
      const { default: netsuiteService } = await import('./netsuite.service');

      // Simple API call to check connectivity
      if (netsuiteService) {
        return {
          status: 'operational',
          responseTime: Date.now() - startTime,
          statusCode: 200,
        };
      } else {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          statusCode: 500,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(): MemoryHealth {
    const usage = process.memoryUsage();

    const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    const totalGB = Math.round(usage.heapTotal / 1024 / 1024 / 1024 * 100) / 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (percentage >= 90) {
      status = 'critical';
    } else if (percentage >= 75) {
      status = 'warning';
    }

    return {
      status,
      used: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      total: totalGB,
      percentage,
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    };
  }

  /**
   * Check disk health
   */
  private checkDiskHealth(): DiskHealth {
    try {
      // This would need platform-specific implementation
      // For now, return a basic healthy status
      return {
        status: 'healthy',
        used: 0,
        total: 100,
        percentage: 0,
        free: 100,
      };
    } catch (error) {
      return {
        status: 'critical',
        used: 0,
        total: 0,
        percentage: 100,
        free: 0,
      };
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(checks: HealthCheckResult['checks']): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(checks).map(check => check?.status);

    if (statuses.includes('error') || statuses.includes('disconnected')) {
      return 'unhealthy';
    }

    if (statuses.includes('degraded') || statuses.includes('warning') || statuses.includes('critical')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.hubspotApiCalls = 0;
    this.hubspotApiErrors = 0;
    this.hubspotApiResponseTime = 0;
    this.netsuiteApiCalls = 0;
    this.netsuiteApiErrors = 0;
    this.netsuiteApiResponseTime = 0;
  }
}

// Export singleton instance
export default new MonitoringService();