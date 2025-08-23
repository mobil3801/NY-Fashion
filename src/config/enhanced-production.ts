import { PRODUCTION_CONFIG, getProductionConfig } from './production';

// Enhanced production configuration with environment variable support
export const ENHANCED_PRODUCTION_CONFIG = {
  ...PRODUCTION_CONFIG,

  // Enhanced API Configuration
  api: {
    ...PRODUCTION_CONFIG.api,
    baseUrl: import.meta.env.VITE_API_BASE_URL || window.location.origin,
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
    retryCount: parseInt(import.meta.env.VITE_API_RETRY_COUNT || '3'),
    retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000'),
    maxConcurrentRequests: parseInt(import.meta.env.VITE_API_MAX_CONCURRENT_REQUESTS || '10'),
    healthUrl: import.meta.env.VITE_API_HEALTH_URL || '/api/health',
    enforceHttps: import.meta.env.NODE_ENV === 'production'
  },

  // Enhanced Database Configuration
  database: {
    ...PRODUCTION_CONFIG.database,
    connectionPoolSize: parseInt(import.meta.env.VITE_DB_CONNECTION_POOL_SIZE || '20'),
    queryTimeout: parseInt(import.meta.env.VITE_DB_QUERY_TIMEOUT || '30000'),
    maxConcurrentQueries: parseInt(import.meta.env.VITE_DB_MAX_CONCURRENT_QUERIES || '10'),
    enableQueryCache: import.meta.env.VITE_DB_ENABLE_QUERY_CACHE !== 'false',
    enableOptimization: import.meta.env.VITE_DB_ENABLE_OPTIMIZATION !== 'false',
    enableConnectionPooling: import.meta.env.VITE_DB_ENABLE_CONNECTION_POOLING !== 'false'
  },

  // Enhanced Security Configuration
  security: {
    ...PRODUCTION_CONFIG.security,
    enableCSRF: import.meta.env.VITE_ENABLE_CSRF !== 'false',
    enableContentSecurityPolicy: import.meta.env.VITE_ENABLE_CSP !== 'false',
    sessionTimeout: parseInt(import.meta.env.VITE_SESSION_TIMEOUT || '3600000'),
    maxLoginAttempts: parseInt(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(import.meta.env.VITE_LOCKOUT_DURATION || '900000'),
    enableRateLimit: import.meta.env.VITE_ENABLE_RATE_LIMIT !== 'false',
    enableSecurityHeaders: import.meta.env.VITE_ENABLE_SECURITY_HEADERS !== 'false',
    enableCORS: import.meta.env.VITE_ENABLE_CORS !== 'false',

    // Content Security Policy
    cspDirectives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.ezsite.ai"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", "data:", "https:", "blob:"],
      'connect-src': ["'self'", "https://api.ezsite.ai", "wss://api.ezsite.ai"],
      'font-src': ["'self'", "data:"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'child-src': ["'none'"]
    }
  },

  // Enhanced Monitoring Configuration
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    healthCheckInterval: parseInt(import.meta.env.VITE_HEALTH_CHECK_INTERVAL || '60000'),
    enableAutoHealthCheck: import.meta.env.VITE_ENABLE_AUTO_HEALTH_CHECK !== 'false',
    enablePerformanceMetrics: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false',
    enableMemoryMonitoring: import.meta.env.VITE_ENABLE_MEMORY_MONITORING !== 'false',
    enableApiMetrics: import.meta.env.VITE_ENABLE_API_METRICS !== 'false',
    metricsFlushInterval: parseInt(import.meta.env.VITE_METRICS_FLUSH_INTERVAL || '30000'),

    alertThresholds: {
      apiResponseTime: parseInt(import.meta.env.VITE_API_RESPONSE_THRESHOLD || '2000'),
      memoryUsage: parseFloat(import.meta.env.VITE_MEMORY_THRESHOLD || '0.8'),
      errorRate: parseFloat(import.meta.env.VITE_ERROR_RATE_THRESHOLD || '0.05'),
      diskUsage: parseFloat(import.meta.env.VITE_DISK_THRESHOLD || '0.9')
    }
  },

  // Enhanced Network Configuration
  network: {
    heartbeatInterval: parseInt(import.meta.env.VITE_HEARTBEAT_INTERVAL_MS || '30000'),
    heartbeatTimeout: parseInt(import.meta.env.VITE_HEARTBEAT_TIMEOUT_MS || '5000'),
    maxRetries: parseInt(import.meta.env.VITE_API_RETRY_COUNT || '3'),
    baseDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000'),
    maxDelay: parseInt(import.meta.env.VITE_API_MAX_RETRY_DELAY || '10000'),
    backoffFactor: 2,
    debounceMs: 1500
  },

  // Enhanced File Upload Configuration
  fileUpload: {
    ...PRODUCTION_CONFIG.fileUpload,
    maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || PRODUCTION_CONFIG.fileUpload.allowedTypes,
    enableImageCompression: import.meta.env.VITE_ENABLE_IMAGE_COMPRESSION !== 'false',
    imageQuality: parseFloat(import.meta.env.VITE_IMAGE_QUALITY || '0.8'),
    enableProgressTracking: import.meta.env.VITE_ENABLE_PROGRESS_TRACKING !== 'false',

    // Enhanced security
    enableVirusScanning: import.meta.env.VITE_ENABLE_VIRUS_SCAN === 'true',
    quarantineUnsafeFiles: true,
    validateMimeType: true,
    enableFileNameSanitization: true
  }
} as const;

// Validation function to ensure production configuration is secure
export const validateProductionConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate API configuration
  if (import.meta.env.NODE_ENV === 'production') {
    const apiBaseUrl = ENHANCED_PRODUCTION_CONFIG.api.baseUrl;

    if (!apiBaseUrl.startsWith('https://')) {
      errors.push('Production API must use HTTPS');
    }

    if (ENHANCED_PRODUCTION_CONFIG.development.enableDebugMode) {
      errors.push('Debug mode must be disabled in production');
    }

    if (ENHANCED_PRODUCTION_CONFIG.development.enableConsoleLogging) {
      warnings.push('Console logging should be disabled in production');
    }

    if (ENHANCED_PRODUCTION_CONFIG.development.enableSourceMaps) {
      warnings.push('Source maps should be disabled in production');
    }
  }

  // Validate security configuration
  if (!ENHANCED_PRODUCTION_CONFIG.security.enableCSRF) {
    warnings.push('CSRF protection should be enabled');
  }

  if (!ENHANCED_PRODUCTION_CONFIG.security.enableContentSecurityPolicy) {
    warnings.push('Content Security Policy should be enabled');
  }

  // Validate monitoring configuration
  if (!ENHANCED_PRODUCTION_CONFIG.monitoring.enablePerformanceMetrics) {
    warnings.push('Performance monitoring should be enabled');
  }

  return { errors, warnings };
};

// Enhanced configuration getter with validation
export const getEnhancedProductionConfig = () => {
  const validation = validateProductionConfig();

  if (validation.errors.length > 0) {
    console.error('Production configuration errors:', validation.errors);
    throw new Error(`Production configuration validation failed: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn('Production configuration warnings:', validation.warnings);
  }

  return ENHANCED_PRODUCTION_CONFIG;
};

// Type-safe environment variable getter
export const getSecureEnvVar = (name: string, defaultValue: string | number, required = false): string | number => {
  const value = import.meta.env[name];

  if (required && (value === undefined || value === null || value === '')) {
    throw new Error(`Required environment variable ${name} is not set`);
  }

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // For numeric values, attempt to parse as number
  if (typeof defaultValue === 'number') {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      console.warn(`Invalid numeric value for ${name}: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return numValue;
  }

  return value;
};

export default ENHANCED_PRODUCTION_CONFIG;