
export const stagingConfig = {
  NODE_ENV: 'staging',
  API_BASE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/nyfashion_staging',
  REDIS_URL: 'redis://localhost:6379/1',

  // Deployment settings
  DEPLOYMENT_ENVIRONMENT: 'staging',
  BLUE_GREEN_ENABLED: true,
  ZERO_DOWNTIME_DEPLOYMENT: false,

  // Performance settings
  ENABLE_COMPRESSION: true,
  ENABLE_CACHING: true,
  CDN_ENABLED: false,
  ASSET_OPTIMIZATION: true,

  // Monitoring settings
  METRICS_ENABLED: true,
  LOG_LEVEL: 'debug',
  HEALTH_CHECK_INTERVAL: 30000,
  PERFORMANCE_MONITORING: true,

  // Security settings
  SSL_ENABLED: false,
  SECURITY_HEADERS_ENABLED: true,
  RATE_LIMITING_ENABLED: true,

  // Backup settings
  AUTO_BACKUP_ENABLED: true,
  BACKUP_RETENTION_DAYS: 7,
  BACKUP_SCHEDULE: '0 2 * * *', // Daily at 2 AM

  // Infrastructure settings
  CONTAINER_REGISTRY: 'localhost:5000',
  LOAD_BALANCER_ENABLED: false,
  AUTO_SCALING_ENABLED: false,

  // Rollback settings
  ROLLBACK_STRATEGY: 'blue-green',
  AUTOMATIC_ROLLBACK_ON_FAILURE: true,
  ROLLBACK_TIMEOUT_SECONDS: 300
};