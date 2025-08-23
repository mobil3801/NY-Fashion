export const PRODUCTION_CONFIG = {
  // API Configuration
  api: {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 30000,
    maxConcurrentRequests: 10,
    rateLimit: {
      window: 60000, // 1 minute
      maxRequests: 100
    }
  },

  // Performance Configuration
  performance: {
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    backgroundSyncInterval: 30000, // 30 seconds
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    enableServiceWorker: false, // Disabled for EasySite integration
    lazyLoadChunkSize: 250000, // 250KB chunks
    preloadCriticalResources: true,
    // Enhanced Performance Configuration
    enablePerformanceMonitoring: true,
    enableMemoryMonitoring: true,
    enableGCHints: process.env.NODE_ENV === 'development',
    clearConsoleOnCleanup: process.env.NODE_ENV === 'production',

    // Cache Configuration
    cacheMaxSize: parseInt(process.env.VITE_CACHE_MAX_SIZE || '1000'),
    cacheDefaultTTL: parseInt(process.env.VITE_CACHE_TTL || '300000'), // 5 minutes
    enableCachePersistence: process.env.VITE_CACHE_PERSISTENCE !== 'false',

    // Bundle Optimization
    enableCodeSplitting: true,
    enableLazyLoading: true
  },

  // Error Handling Configuration
  errorHandling: {
    enableGlobalErrorBoundary: true,
    logToConsole: process.env.NODE_ENV === 'development',
    sendTelemetry: process.env.NODE_ENV === 'production',
    maxErrorStackTrace: 1000,
    errorReportingInterval: 60000, // 1 minute

    // Audit Configuration
    auditRetentionDays: parseInt(process.env.VITE_AUDIT_RETENTION || '90'),
    enableAuditLogging: process.env.VITE_AUDIT_LOGGING !== 'false'
  },

  // Security Configuration
  security: {
    enableCSRF: true,
    enableContentSecurityPolicy: true,
    sessionTimeout: 3600000, // 1 hour
    maxLoginAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    enableRateLimit: true,
    sanitizeInputs: true,

    // Enhanced Security
    enableSecurityHeaders: true,
    enableCORS: true
  },

  // Database Configuration
  database: {
    connectionPoolSize: 20,
    queryTimeout: 30000,
    enableTransactions: true,
    enableOptimisticLocking: true,
    batchSize: 100,
    enableQueryCache: true,

    // Enhanced Database Config
    enableQueryOptimization: true,
    enableConnectionPooling: true,
    maxConcurrentQueries: parseInt(process.env.VITE_MAX_CONCURRENT_QUERIES || '10')
  },

  // Monitoring Configuration
  monitoring: {
    enablePerformanceMetrics: true,
    enableUserBehaviorTracking: false, // Privacy-focused
    enableErrorTracking: true,
    enableApiMetrics: true,
    metricsFlushInterval: 30000, // 30 seconds

    // Health Check Configuration
    healthCheckInterval: parseInt(process.env.VITE_HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
    enableAutoHealthCheck: true,

    // Alert Thresholds
    alertThresholds: {
      apiResponseTime: parseInt(process.env.VITE_API_RESPONSE_THRESHOLD || '2000'),
      memoryUsage: parseFloat(process.env.VITE_MEMORY_THRESHOLD || '0.8'),
      errorRate: parseFloat(process.env.VITE_ERROR_RATE_THRESHOLD || '0.05'),
      diskUsage: parseFloat(process.env.VITE_DISK_THRESHOLD || '0.9')
    }
  },

  // Feature Flags
  features: {
    enableOfflineMode: true,
    enableRealTimeUpdates: true,
    enableAdvancedSearch: true,
    enableDataExport: true,
    enableBulkOperations: true,
    enableAuditTrail: true,
    enableAdvancedReporting: true
  },

  // UI/UX Configuration
  ui: {
    enableAnimations: true,
    enableTransitions: true,
    enableAccessibility: true,
    enableResponsiveDesign: true,
    enableDarkMode: true,
    enableHighContrast: true,
    defaultPageSize: 25,
    maxPageSize: 100
  },

  // Development Configuration
  development: {
    enableDebugMode: process.env.NODE_ENV === 'development',
    enableMockData: false, // Always use real data in production
    enableTestingTools: process.env.NODE_ENV === 'development',
    enableConsoleLogging: process.env.NODE_ENV === 'development',
    enableSourceMaps: process.env.NODE_ENV === 'development'
  },

  // File Upload Configuration
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],

    enableImageCompression: true,
    imageQuality: 0.8,
    enableProgressTracking: true
  }
} as const;

// Environment-specific overrides
export const getProductionConfig = () => {
  const config = { ...PRODUCTION_CONFIG };

  // Production-specific overrides
  if (process.env.NODE_ENV === 'production') {
    config.errorHandling.logToConsole = false;
    config.development.enableDebugMode = false;
    config.development.enableConsoleLogging = false;
    config.development.enableSourceMaps = false;
  }

  return config;
};