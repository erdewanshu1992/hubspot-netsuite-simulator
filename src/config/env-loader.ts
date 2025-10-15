import dotenv from 'dotenv';
import { resolve } from 'path';

/**
 * Environment Configuration Loader
 * Loads environment variables based on NODE_ENV
 */

export class EnvLoader {
  private static instance: EnvLoader;
  private loaded = false;

  private constructor() {}

  public static getInstance(): EnvLoader {
    if (!EnvLoader.instance) {
      EnvLoader.instance = new EnvLoader();
    }
    return EnvLoader.instance;
  }

  /**
   * Load environment configuration
   */
  public load(): void {
    if (this.loaded) {
      return;
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const rootDir = resolve(__dirname, '../../');

    // Load base environment file
    const baseEnvPath = resolve(rootDir, '.env');
    dotenv.config({ path: baseEnvPath });

    // Load environment-specific file
    const envPath = resolve(rootDir, 'env', `.env.${nodeEnv}`);
    dotenv.config({ path: envPath });

    this.loaded = true;
    console.log(`✅ Loaded environment configuration for: ${nodeEnv}`);
  }

  /**
   * Get environment variable with validation
   */
  public get(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;

    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }

    return value;
  }

  /**
   * Get environment variable (optional)
   */
  public getOptional(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
  }

  /**
   * Get boolean environment variable
   */
  public getBoolean(key: string, defaultValue = false): boolean {
    const value = process.env[key];

    if (!value) {
      return defaultValue;
    }

    return value.toLowerCase() === 'true';
  }

  /**
   * Get numeric environment variable
   */
  public getNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];

    if (!value) {
      if (defaultValue === undefined) {
        throw new Error(`Required numeric environment variable ${key} is not set`);
      }
      return defaultValue;
    }

    const parsed = parseInt(value, 10);

    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} is not a valid number: ${value}`);
    }

    return parsed;
  }

  /**
   * Validate required environment variables
   */
  public validateRequired(keys: string[]): void {
    const missing = keys.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Get current environment info
   */
  public getEnvironmentInfo(): {
    nodeEnv: string;
    appName: string;
    port: number;
    isDevelopment: boolean;
    isProduction: boolean;
    isStaging: boolean;
  } {
    const nodeEnv = process.env.NODE_ENV || 'development';

    return {
      nodeEnv,
      appName: this.getOptional('APP_NAME') || 'HubSpot-NetSuite Simulator',
      port: this.getNumber('PORT', 3000),
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      isStaging: nodeEnv === 'staging',
    };
  }
}

// Export singleton instance
export const envLoader = EnvLoader.getInstance();

/**
 * Convenience functions for easy access
 */
export const env = {
  get: (key: string, defaultValue?: string) => envLoader.get(key, defaultValue),
  getOptional: (key: string, defaultValue?: string) => envLoader.getOptional(key, defaultValue),
  getBoolean: (key: string, defaultValue?: boolean) => envLoader.getBoolean(key, defaultValue),
  getNumber: (key: string, defaultValue?: number) => envLoader.getNumber(key, defaultValue),
  validateRequired: (keys: string[]) => envLoader.validateRequired(keys),
  getEnvironmentInfo: () => envLoader.getEnvironmentInfo(),
};