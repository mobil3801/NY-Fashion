
// Centralized environment configuration
import { environmentValidator, getEnvironmentConfig } from '@/utils/env-validator';

// Get validated environment configuration
const envConfig = getEnvironmentConfig();

export const ENV_CONFIG = {
  // Core environment settings
  NODE_ENV: envConfig.NODE_ENV,
  MODE: envConfig.MODE,
  DEV: envConfig.DEV,
  PROD: envConfig.PROD,
  IS_DEVELOPMENT: envConfig.NODE_ENV === 'development' || envConfig.DEV === true,
  IS_PRODUCTION: envConfig.NODE_ENV === 'production' || envConfig.PROD === true,

  // API Configuration
  API: {
    BASE_URL: envConfig.API_BASE_URL,
    TIMEOUT: envConfig.API_TIMEOUT,
    RETRY_COUNT: envConfig.API_RETRY_COUNT,
    HEALTH_URL: envConfig.API_BASE_URL + '/api/health'
  },

  // Feature Flags
  FEATURES: {
    ENABLE_DEBUG: envConfig.ENABLE_DEBUG,
    ENABLE_CONSOLE_LOGGING: envConfig.ENABLE_CONSOLE_LOGGING,
    DISABLE_DEBUG_ROUTES: envConfig.DISABLE_DEBUG_ROUTES,
    DISABLE_DEBUG_PROVIDER: envConfig.DISABLE_DEBUG_PROVIDER
  },

  // Security Configuration
  SECURITY: {
    ENABLE_SECURITY_HEADERS: envConfig.ENABLE_SECURITY_HEADERS,
    ENABLE_HTTPS_ENFORCEMENT: envConfig.ENABLE_HTTPS_ENFORCEMENT,
    MAX_LOGIN_ATTEMPTS: envConfig.MAX_LOGIN_ATTEMPTS,
    SESSION_TIMEOUT: envConfig.SESSION_TIMEOUT
  },

  // Performance Configuration
  PERFORMANCE: {
    CACHE_MAX_SIZE: envConfig.CACHE_MAX_SIZE,
    CACHE_TTL: envConfig.CACHE_TTL,
    HEALTH_CHECK_INTERVAL: envConfig.HEALTH_CHECK_INTERVAL
  },

  // Database Configuration
  DATABASE: {
    CONNECTION_POOL_SIZE: envConfig.DB_CONNECTION_POOL_SIZE,
    QUERY_TIMEOUT: envConfig.DB_QUERY_TIMEOUT,
    MAX_CONCURRENT_QUERIES: envConfig.DB_MAX_CONCURRENT_QUERIES,
    ENABLE_QUERY_CACHE: envConfig.DB_ENABLE_QUERY_CACHE
  }
};

// Validation function
export const validateEnvironment = () => {
  const validation = environmentValidator.validateAll();
  
  console.log('Environment Validation Result:', {
    environment: validation.environment,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings
  });

  return validation;
};

// Environment info for debugging
export const getEnvironmentInfo = () => ({
  nodeEnv: ENV_CONFIG.NODE_ENV,
  mode: ENV_CONFIG.MODE,
  isDev: ENV_CONFIG.IS_DEVELOPMENT,
  isProd: ENV_CONFIG.IS_PRODUCTION,
  apiUrl: ENV_CONFIG.API.BASE_URL,
  features: ENV_CONFIG.FEATURES,
  timestamp: new Date().toISOString()
});

export default ENV_CONFIG;
