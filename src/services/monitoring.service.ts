import pino from 'pino';
import { ENV } from '../config/env';

export interface HealthMetrics {
  timestamp: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  apiCalls: {
    hubspot: { success: number; failure: number; total: number };
    netsuite: { success: number; failure: number; total: number };
  };
  webhooks: {
    processed: number;
    failed: number;
    duplicates: number;
  };
  errors: {
    count: number;
    recent: Array<{ timestamp: number; error: string; context: string }>;
  };
  cache: {
    redisConnected: boolean;
    keyCount: number;
    memoryUsage?: string;
  };
  circuitBreakers: {
    [serviceName: string]: {
      state: string;
      failureCount: number;
      lastFailure?: number;
    };
  };
}

export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private logger: pino.Logger;
  private metrics: HealthMetrics;
  private performanceLogs: PerformanceMetrics[] = [];
  private readonly maxPerformanceLogs = 1000;
  private readonly maxRecentErrors = 50;

  constructor() {
    this.logger = pino({
      level: ENV.LOG_LEVEL,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime
    });

    this.metrics = this.initializeMetrics();

    // Start periodic health checks
    this.startPeriodicHealthCheck();
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): HealthMetrics {
    return {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      apiCalls: {
        hubspot: { success: 0, failure: 0, total: 0 },
        netsuite: { success: 0, failure: 0, total: 0 }
      },
      webhooks: {
        processed: 0,
        failed: 0,
        duplicates: 0
      },
      errors: {
        count: 0,
        recent: []
      },
      cache: {
        redisConnected: false,
        keyCount: 0
      },
      circuitBreakers: {}
    };
  }

  /**
   * Log API call metrics
   */
  logApiCall(service: 'hubspot' | 'netsuite', success: boolean, duration?: number): void {
    this.metrics.apiCalls[service].total++;
    if (success) {
      this.metrics.apiCalls[service].success++;
    } else {
      this.metrics.apiCalls[service].failure++;
    }

    this.logger.info({
      service,
      success,
      duration,
      totalCalls: this.metrics.apiCalls[service].total,
      successRate: this.calculateSuccessRate(this.metrics.apiCalls[service])
    }, `API call to ${service}`);
  }

  /**
   * Log webhook processing metrics
   */
  logWebhookProcessed(success: boolean, isDuplicate: boolean = false): void {
    this.metrics.webhooks.processed++;
    if (!success) {
      this.metrics.webhooks.failed++;
    }
    if (isDuplicate) {
      this.metrics.webhooks.duplicates++;
    }

    this.logger.info({
      success,
      isDuplicate,
      totalProcessed: this.metrics.webhooks.processed,
      successRate: this.calculateWebhookSuccessRate()
    }, 'Webhook processed');
  }

  /**
   * Log error with context
   */
  logError(error: Error, context: string, metadata?: Record<string, any>): void {
    this.metrics.errors.count++;

    const errorInfo = {
      timestamp: Date.now(),
      error: error.message,
      context,
      stack: error.stack,
      ...metadata
    };

    // Add to recent errors
    this.metrics.errors.recent.unshift(errorInfo);
    if (this.metrics.errors.recent.length > this.maxRecentErrors) {
      this.metrics.errors.recent = this.metrics.errors.recent.slice(0, this.maxRecentErrors);
    }

    this.logger.error({
      error: error.message,
      context,
      metadata,
      totalErrors: this.metrics.errors.count
    }, 'Integration error occurred');
  }

  /**
   * Log performance metrics
   */
  logPerformance(operationName: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const performanceMetric: PerformanceMetrics = {
      operationName,
      duration,
      success,
      timestamp: Date.now(),
      metadata
    };

    // Add to performance logs
    this.performanceLogs.unshift(performanceMetric);
    if (this.performanceLogs.length > this.maxPerformanceLogs) {
      this.performanceLogs = this.performanceLogs.slice(0, this.maxPerformanceLogs);
    }

    // Log slow operations as warnings
    if (duration > 5000) { // 5 seconds threshold
      this.logger.warn({
        operationName,
        duration,
        success,
        metadata
      }, 'Slow operation detected');
    } else {
      this.logger.info({
        operationName,
        duration,
        success,
        metadata
      }, 'Operation performance');
    }
  }

  /**
   * Update cache status
   */
  updateCacheStatus(redisConnected: boolean, keyCount: number, memoryUsage?: string): void {
    this.metrics.cache = {
      redisConnected,
      keyCount,
      memoryUsage
    };
  }

  /**
   * Update circuit breaker status
   */
  updateCircuitBreakerStatus(serviceName: string, state: string, failureCount: number, lastFailure?: number): void {
    this.metrics.circuitBreakers[serviceName] = {
      state,
      failureCount,
      lastFailure
    };
  }

  /**
   * Get current health metrics
   */
  getHealthMetrics(): HealthMetrics {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageDuration: number;
    slowestOperations: PerformanceMetrics[];
    fastestOperations: PerformanceMetrics[];
    successRate: number;
    totalOperations: number;
  } {
    if (this.performanceLogs.length === 0) {
      return {
        averageDuration: 0,
        slowestOperations: [],
        fastestOperations: [],
        successRate: 0,
        totalOperations: 0
      };
    }

    const durations = this.performanceLogs.map(log => log.duration);
    const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    const successfulOperations = this.performanceLogs.filter(log => log.success);
    const successRate = (successfulOperations.length / this.performanceLogs.length) * 100;

    const sortedByDuration = [...this.performanceLogs].sort((a, b) => b.duration - a.duration);

    return {
      averageDuration,
      slowestOperations: sortedByDuration.slice(0, 10),
      fastestOperations: sortedByDuration.slice(-10).reverse(),
      successRate,
      totalOperations: this.performanceLogs.length
    };
  }

  /**
   * Check if the integration is healthy
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: HealthMetrics;
  }> {
    const issues: string[] = [];
    const metrics = this.getHealthMetrics();

    // Check API success rates
    const hubspotSuccessRate = this.calculateSuccessRate(metrics.apiCalls.hubspot);
    const netsuiteSuccessRate = this.calculateSuccessRate(metrics.apiCalls.netsuite);

    if (hubspotSuccessRate < 90) {
      issues.push(`HubSpot API success rate is low: ${hubspotSuccessRate.toFixed(2)}%`);
    }

    if (netsuiteSuccessRate < 90) {
      issues.push(`NetSuite API success rate is low: ${netsuiteSuccessRate.toFixed(2)}%`);
    }

    // Check webhook success rate
    const webhookSuccessRate = this.calculateWebhookSuccessRate();
    if (webhookSuccessRate < 95) {
      issues.push(`Webhook processing success rate is low: ${webhookSuccessRate.toFixed(2)}%`);
    }

    // Check memory usage
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 85) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }

    // Check Redis connectivity
    if (!metrics.cache.redisConnected) {
      issues.push('Redis cache is not connected');
    }

    // Check for recent errors
    const recentErrorCount = metrics.errors.recent.filter(
      error => Date.now() - error.timestamp < 300000 // Last 5 minutes
    ).length;

    if (recentErrorCount > 10) {
      issues.push(`High error rate: ${recentErrorCount} errors in the last 5 minutes`);
    }

    // Check circuit breakers
    const openCircuits = Object.entries(metrics.circuitBreakers)
      .filter(([_, status]) => status.state === 'OPEN').length;

    if (openCircuits > 0) {
      issues.push(`${openCircuits} circuit breaker(s) are open`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics
    };
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthCheck(): void {
    setInterval(async () => {
      try {
        const health = await this.checkHealth();

        if (!health.healthy) {
          this.logger.warn({
            issues: health.issues,
            metrics: health.metrics
          }, 'Integration health issues detected');

          // Could trigger alerts here
          if (health.issues.some(issue => issue.includes('High error rate') || issue.includes('circuit breaker'))) {
            await this.sendHealthAlert(health.issues);
          }
        } else {
          this.logger.info('Integration health check passed');
        }
      } catch (error) {
        this.logger.error({ error: (error as Error).message }, 'Health check failed');
      }
    }, 60000); // Check every minute
  }

  /**
   * Send health alert (placeholder for actual alerting implementation)
   */
  private async sendHealthAlert(issues: string[]): Promise<void> {
    this.logger.error({
      issues,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    }, 'Integration health alert');

    // Here you would integrate with actual alerting systems like:
    // - Slack notifications
    // - PagerDuty
    // - Email alerts
    // - SMS alerts
    console.log('🚨 HEALTH ALERT:', issues.join(', '));
  }

  /**
   * Calculate success rate for API calls
   */
  private calculateSuccessRate(calls: { success: number; failure: number; total: number }): number {
    if (calls.total === 0) return 100;
    return (calls.success / calls.total) * 100;
  }

  /**
   * Calculate webhook success rate
   */
  private calculateWebhookSuccessRate(): number {
    const { processed, failed } = this.metrics.webhooks;
    if (processed === 0) return 100;
    return ((processed - failed) / processed) * 100;
  }

  /**
   * Reset metrics (useful for testing or manual reset)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.performanceLogs = [];
    this.logger.info('Metrics reset');
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    health: HealthMetrics;
    performance: ReturnType<MonitoringService['getPerformanceStats']>;
    timestamp: number;
  } {
    return {
      health: this.getHealthMetrics(),
      performance: this.getPerformanceStats(),
      timestamp: Date.now()
    };
  }

  /**
   * Create a child logger with context
   */
  createChildLogger(context: string): pino.Logger {
    return this.logger.child({ context });
  }

  /**
   * Log integration startup
   */
  logStartup(): void {
    this.logger.info({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      environment: ENV.LOG_LEVEL
    }, 'HubSpot-NetSuite Integration started');
  }

  /**
   * Log integration shutdown
   */
  logShutdown(): void {
    const finalMetrics = this.getHealthMetrics();

    this.logger.info({
      uptime: finalMetrics.uptime,
      totalApiCalls: finalMetrics.apiCalls.hubspot.total + finalMetrics.apiCalls.netsuite.total,
      totalWebhooks: finalMetrics.webhooks.processed,
      totalErrors: finalMetrics.errors.count,
      memoryUsage: finalMetrics.memoryUsage
    }, 'HubSpot-NetSuite Integration shutting down');
  }
}

export default new MonitoringService();