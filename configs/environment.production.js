
export const productionConfig = {
  NODE_ENV: 'production',
  API_BASE_URL: 'https://api.nyfashion.com',
  DATABASE_URL: 'postgresql://user:password@db.nyfashion.com:5432/nyfashion_production',
  REDIS_URL: 'redis://cache.nyfashion.com:6379/0',

  // Deployment settings
  DEPLOYMENT_ENVIRONMENT: 'production',
  BLUE_GREEN_ENABLED: true,
  ZERO_DOWNTIME_DEPLOYMENT: true,

  // Performance settings
  ENABLE_COMPRESSION: true,
  ENABLE_CACHING: true,
  CDN_ENABLED: true,
  CDN_URL: 'https://cdn.nyfashion.com',
  ASSET_OPTIMIZATION: true,

  // Monitoring settings
  METRICS_ENABLED: true,
  LOG_LEVEL: 'warn',
  HEALTH_CHECK_INTERVAL: 15000,
  PERFORMANCE_MONITORING: true,

  // Security settings
  SSL_ENABLED: true,
  SECURITY_HEADERS_ENABLED: true,
  RATE_LIMITING_ENABLED: true,
  CSP_ENABLED: true,

  // Backup settings
  AUTO_BACKUP_ENABLED: true,
  BACKUP_RETENTION_DAYS: 30,
  BACKUP_SCHEDULE: '0 1 * * *', // Daily at 1 AM

  // Infrastructure settings
  CONTAINER_REGISTRY: 'registry.nyfashion.com',
  LOAD_BALANCER_ENABLED: true,
  AUTO_SCALING_ENABLED: true,
  MAX_INSTANCES: 10,
  MIN_INSTANCES: 2,

  // Rollback settings
  ROLLBACK_STRATEGY: 'blue-green',
  AUTOMATIC_ROLLBACK_ON_FAILURE: true,
  ROLLBACK_TIMEOUT_SECONDS: 180,

  // CDN settings
  CDN_CACHE_TTL: {
    static: 31536000, // 1 year
    images: 2592000, // 30 days
    api: 300, // 5 minutes
    html: 3600 // 1 hour
  },

  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    response_time_ms: 2000,
    error_rate_percent: 1,
    cpu_usage_percent: 80,
    memory_usage_percent: 85,
    disk_usage_percent: 90
  }
};