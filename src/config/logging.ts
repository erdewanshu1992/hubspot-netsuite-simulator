import pino from 'pino';
import { env } from './env-loader';

/**
 * Logging Configuration
 * Centralized logging setup for the application
 */

export interface LogContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private logger: pino.Logger;
  private component: string;

  constructor(component: string = 'app') {
    this.component = component;

    // Configure Pino logger based on environment
    const isProduction = env.getOptional('NODE_ENV') === 'production';
    const logLevel = env.getOptional('LOG_LEVEL') || (isProduction ? 'info' : 'debug');

    this.logger = pino({
      level: logLevel,
      name: this.component,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => {
          return { level: label };
        },
        log: (obj: any) => {
          // Add component to all logs
          obj.component = this.component;
          return obj;
        },
      },
      redact: {
        paths: [
          'password',
          'token',
          'authorization',
          'cookie',
          'secret',
          '*.password',
          '*.token',
          '*.authorization',
          '*.cookie',
          '*.secret',
        ],
        censor: '***REDACTED***',
      },
      serializers: {
        error: pino.stdSerializers.err,
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
    });

    // Add file transport for production
    if (isProduction && env.getOptional('LOG_FILE')) {
      const logFile = env.getOptional('LOG_FILE')!;
      this.logger = this.logger.child({});

      // Note: In production, you might want to use pino-tee or similar
      // to write to both console and file
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.logger.info(context || {}, message);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(
      {
        ...context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      message
    );
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(context || {}, message);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug(context || {}, message);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    this.logger.fatal(
      {
        ...context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      message
    );
  }

  /**
   * Log request start
   */
  logRequest(req: any, context?: LogContext): void {
    this.info('Request started', {
      ...context,
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.id,
      },
    });
  }

  /**
   * Log request completion
   */
  logRequestComplete(req: any, res: any, duration: number, context?: LogContext): void {
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    this[level]('Request completed', {
      ...context,
      metadata: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.id,
      },
    });
  }

  /**
   * Log database operation
   */
  logDatabase(operation: string, collection: string, duration: number, context?: LogContext): void {
    this.debug('Database operation', {
      ...context,
      metadata: {
        operation,
        collection,
        duration: `${duration}ms`,
      },
    });
  }

  /**
   * Log external API call
   */
  logExternalApi(provider: string, operation: string, duration: number, success: boolean, context?: LogContext): void {
    const level = success ? 'debug' : 'warn';

    this[level]('External API call', {
      ...context,
      metadata: {
        provider,
        operation,
        duration: `${duration}ms`,
        success,
      },
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    // Log slow operations as warnings
    if (duration > 1000) {
      this.warn('Slow operation detected', {
        ...context,
        metadata: {
          operation,
          duration: `${duration}ms`,
        },
      });
    } else {
      this.debug('Performance metrics', {
        ...context,
        metadata: {
          operation,
          duration: `${duration}ms`,
        },
      });
    }
  }
}

/**
 * Create logger instance for component
 */
export function createLogger(component: string): Logger {
  return new Logger(component);
}

/**
 * Default application logger
 */
export const logger = createLogger('app');

/**
 * Database operations logger
 */
export const dbLogger = createLogger('database');

/**
 * API operations logger
 */
export const apiLogger = createLogger('api');

/**
 * Authentication logger
 */
export const authLogger = createLogger('auth');

/**
 * Webhook logger
 */
export const webhookLogger = createLogger('webhook');

/**
 * Monitoring logger
 */
export const monitoringLogger = createLogger('monitoring');