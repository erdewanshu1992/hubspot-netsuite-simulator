/**
 * PM2 Ecosystem Configuration
 * Production process management for HubSpot-NetSuite Simulator
 */

module.exports = {
  apps: [
    {
      name: 'hubspot-netsuite-simulator',
      script: 'src/index.js',

      // Deployment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Instance configuration
      instances: process.env.PM2_INSTANCES || 'max', // Use 'max' for all CPU cores
      exec_mode: 'cluster', // Load balancing across multiple instances

      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',

      // Monitoring
      monitoring: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Health check
      health_check: {
        enabled: true,
        url: 'http://localhost:3000/health',
        interval: '30s',
        timeout: '5000ms',
        retries: 3,
        retry_delay: '5000ms',
      },

      // Restart on file changes (development)
      watch: false, // Disabled for production
      ignore_watch: ['node_modules', 'logs', 'public', '*.log'],

      // Graceful shutdown
      graceful_shutdown_timeout: 10000,
      graceful_shutdown_signal: 'SIGTERM',

      // Environment-specific configurations
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        PORT: 3000,
      },

      env_staging: {
        NODE_ENV: 'staging',
        LOG_LEVEL: 'info',
        PORT: 3000,
      },

      // Merge logs for better debugging
      merge_logs: true,

      // Auto restart if process is killed
      autorestart: true,

      // Restart delay between crashes
      restart_delay: 4000,

      // Source map support for debugging
      source_map_support: true,
    },
  ],
};