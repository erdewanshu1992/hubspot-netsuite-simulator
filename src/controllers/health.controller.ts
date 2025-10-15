import { Request, Response } from 'express';
import monitoringService from '../services/monitoring.service';

/**
 * Health Check Controller
 * Provides endpoints for application health monitoring
 */

export class HealthController {
  /**
   * Basic health check endpoint
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();

      const statusCode = healthCheck.status === 'healthy' ? 200 :
                        healthCheck.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: healthCheck.status,
        timestamp: healthCheck.timestamp,
        uptime: healthCheck.uptime,
        version: healthCheck.version,
        responseTime: healthCheck.responseTime,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Detailed health check endpoint
   */
  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();

      const statusCode = healthCheck.status === 'healthy' ? 200 :
                        healthCheck.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(healthCheck);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Application metrics endpoint
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = monitoringService.getMetrics();

      res.status(200).json(metrics);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Database health check endpoint
   */
  async getDatabaseHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();
      const dbHealth = healthCheck.checks.database;

      if (!dbHealth) {
        res.status(503).json({
          status: 'unknown',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const statusCode = dbHealth.status === 'connected' ? 200 : 503;

      res.status(statusCode).json({
        status: dbHealth.status,
        timestamp: new Date().toISOString(),
        responseTime: dbHealth.responseTime,
        connections: dbHealth.connections,
        error: dbHealth.error,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * External APIs health check endpoint
   */
  async getExternalApisHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();
      const hubspotHealth = healthCheck.checks.hubspot;
      const netsuiteHealth = healthCheck.checks.netsuite;

      res.status(200).json({
        hubspot: hubspotHealth || { status: 'unknown' },
        netsuite: netsuiteHealth || { status: 'unknown' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Readiness probe endpoint (for Kubernetes/Docker)
   */
  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();

      // Application is ready if overall status is healthy or degraded
      const isReady = healthCheck.status === 'healthy' || healthCheck.status === 'degraded';

      res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Liveness probe endpoint (for Kubernetes/Docker)
   */
  async getLiveness(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await monitoringService.performHealthCheck();

      // Application is alive if it can respond to health checks
      const isAlive = healthCheck.responseTime < 10000; // Less than 10 seconds

      res.status(isAlive ? 200 : 503).json({
        status: isAlive ? 'alive' : 'not alive',
        timestamp: new Date().toISOString(),
        responseTime: healthCheck.responseTime,
      });
    } catch (error) {
      res.status(503).json({
        status: 'not alive',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export default new HealthController();