import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT || 4000),
  HUBSPOT_API_BASE: process.env.HUBSPOT_API_BASE || 'https://api.hubapi.com',
  HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY || '',
  HUBSPOT_OAUTH_TOKEN: process.env.HUBSPOT_OAUTH_TOKEN || '',
  ERP_BASE_URL: process.env.ERP_BASE_URL || 'http://localhost:4000',
  BASE_URL: process.env.BASE_URL || 'http://localhost:4000',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/crm_erp_sync',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  // NetSuite Configuration
  NETSUITE_ACCOUNT_ID: process.env.NETSUITE_ACCOUNT_ID || '',
  NETSUITE_CONSUMER_KEY: process.env.NETSUITE_CONSUMER_KEY || '',
  NETSUITE_CONSUMER_SECRET: process.env.NETSUITE_CONSUMER_SECRET || '',
  NETSUITE_TOKEN_ID: process.env.NETSUITE_TOKEN_ID || '',
  NETSUITE_TOKEN_SECRET: process.env.NETSUITE_TOKEN_SECRET || '',
  NETSUITE_REST_DOMAIN: process.env.NETSUITE_REST_DOMAIN || '',
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  // Email Configuration
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@example.com',
  EMAIL_TO: process.env.EMAIL_TO || 'alerts@example.com',
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: Number(process.env.SMTP_PORT || 2525),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  // Integration Settings
  DEFAULT_ERROR_EMAIL_ADDRESS: process.env.DEFAULT_ERROR_EMAIL_ADDRESS || 'alerts@example.com',
  DEFAULT_ERROR_TO_NAME: process.env.DEFAULT_ERROR_TO_NAME || 'Integration Team',
  WEBHOOK_CACHE_CHECK: process.env.WEBHOOK_CACHE_CHECK === 'true',
  // LaunchDarkly (Feature Flags)
  LAUNCHDARKLY_SDK_KEY: process.env.LAUNCHDARKLY_SDK_KEY || ''
};
