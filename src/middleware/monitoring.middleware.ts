import { Request, Response, NextFunction } from 'express';
import monitoringService from '../services/monitoring.service';

/**
 * Monitoring Middleware
 * Tracks request metrics and performance
 */

export interface MonitoringRequest extends Request {
  startTime?: number;
  monitoring?: {
    startTime: number;
    endTime?: number;
    responseTime?: number;
    success?: boolean;
  };
}

export class MonitoringMiddleware {
  /**
   * Request timing middleware
   */
  static requestTimer(req: MonitoringRequest, res: Response, next: NextFunction): void {
    // Store start time
    req.monitoring = {
      startTime: Date.now(),
    };

    // Track response completion
    res.on('finish', () => {
      if (req.monitoring) {
        req.monitoring.endTime = Date.now();
        req.monitoring.responseTime = req.monitoring.endTime - req.monitoring.startTime;
        req.monitoring.success = res.statusCode >= 200 && res.statusCode < 400;

        // Record metrics
        monitoringService.recordRequest(
          req.monitoring.responseTime,
          req.monitoring.success
        );
      }
    });

    next();
  }

  /**
   * HubSpot API monitoring middleware
   */
  static hubspotApiMonitor(req: MonitoringRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;

      monitoringService.recordHubSpotApiCall(responseTime, success);
    });

    next();
  }

  /**
   * NetSuite API monitoring middleware
   */
  static netsuiteApiMonitor(req: MonitoringRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;

      monitoringService.recordNetSuiteApiCall(responseTime, success);
    });

    next();
  }

  /**
   * Error monitoring middleware
   */
  static errorMonitor(error: Error, req: MonitoringRequest, res: Response, next: NextFunction): void {
    // Record error metrics
    monitoringService.recordRequest(0, false);

    next(error);
  }

  /**
   * Performance monitoring middleware
   */
  static performanceMonitor(req: MonitoringRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      // Log slow requests
      if (responseTime > 5000) { // 5 seconds threshold
        console.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`);
      }

      // Log very slow requests
      if (responseTime > 10000) { // 10 seconds threshold
        console.error(`Very slow request: ${req.method} ${req.path} - ${responseTime}ms`);
      }
    });

    next();
  }

  /**
   * Memory usage monitoring middleware
   */
  static memoryMonitor(req: MonitoringRequest, res: Response, next: NextFunction): void {
    const memUsage = process.memoryUsage();
    const memPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    // Add memory info to response headers (development only)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Memory-Usage', `${memPercentage}%`);
      res.setHeader('X-Memory-Used-MB', Math.round(memUsage.heapUsed / 1024 / 1024));
      res.setHeader('X-Memory-Total-MB', Math.round(memUsage.heapTotal / 1024 / 1024));
    }

    // Log high memory usage
    if (memPercentage > 85) {
      console.warn(`High memory usage: ${memPercentage}%`);
    }

    next();
  }

  /**
   * Request logging middleware
   */
  static requestLogger(req: MonitoringRequest, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Log request start (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Started`);
    }

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log request completion
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.path} - ${statusCode} - ${responseTime}ms`
        );
      }

      // Log errors
      if (statusCode >= 500) {
        console.error(
          `[${new Date().toISOString()}] ${req.method} ${req.path} - ERROR ${statusCode} - ${responseTime}ms`
        );
      }
    });

    next();
  }

  /**
   * Health check middleware for load balancers
   */
  static healthCheck(req: Request, res: Response, next: NextFunction): void {
    // Simple health check for load balancer
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}

/**
 * Convenience function to apply all monitoring middleware
 */
export function applyMonitoringMiddleware(app: any): void {
  app.use(MonitoringMiddleware.requestTimer);
  app.use(MonitoringMiddleware.performanceMonitor);
  app.use(MonitoringMiddleware.memoryMonitor);

  if (process.env.NODE_ENV === 'development') {
    app.use(MonitoringMiddleware.requestLogger);
  }
}

/**
 * Apply API-specific monitoring
 */
export function applyApiMonitoring(app: any, apiPath: string): void {
  // HubSpot API monitoring
  app.use(`${apiPath}/hubspot`, MonitoringMiddleware.hubspotApiMonitor);

  // NetSuite API monitoring
  app.use(`${apiPath}/netsuite`, MonitoringMiddleware.netsuiteApiMonitor);
}