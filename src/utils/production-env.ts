
/**
 * Production-safe environment configuration
 * This file provides environment variables without throwing errors in production
 */

// Get NODE_ENV from multiple sources
const getNodeEnv = (): string => {
  // Check build-time environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const metaEnv = import.meta.env.NODE_ENV || import.meta.env.VITE_NODE_ENV || import.meta.env.MODE;
    if (metaEnv) return metaEnv;
  }

  // Check if we're in a production-like environment
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // EasySite production domains typically contain 'easysite'
    if (hostname.includes('easysite.ai') || hostname.includes('preview.easysite')) {
      return 'production';
    }
  }

  // Default to production for safety
  return 'production';
};

// Cached environment
let cachedEnv: string | null = null;

export const getCurrentEnvironment = (): string => {
  if (cachedEnv === null) {
    cachedEnv = getNodeEnv();
  }
  return cachedEnv;
};

export const isProductionEnv = (): boolean => {
  return getCurrentEnvironment() === 'production';
};

export const isDevelopmentEnv = (): boolean => {
  return getCurrentEnvironment() === 'development';
};

// Safe environment variable getter
export const getEnvVar = (name: string, defaultValue: any = undefined): any => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const value = (import.meta.env as any)[name] || (import.meta.env as any)[`VITE_${name}`];
      if (value !== undefined) return value;
    }
  } catch (error) {

    // Ignore errors in production
  }return defaultValue;
};

// Production-safe configuration
export const PRODUCTION_ENV_CONFIG = {
  NODE_ENV: getCurrentEnvironment(),
  IS_PRODUCTION: isProductionEnv(),
  IS_DEVELOPMENT: isDevelopmentEnv(),

  // API Configuration
  API_BASE_URL: getEnvVar('API_BASE_URL', typeof window !== 'undefined' ? window.location.origin : ''),
  API_TIMEOUT: parseInt(getEnvVar('API_TIMEOUT', '30000')),

  // Feature Flags
  ENABLE_DEBUG: getEnvVar('ENABLE_DEBUG', !isProductionEnv()),
  ENABLE_CONSOLE_LOGGING: getEnvVar('ENABLE_CONSOLE_LOGGING', !isProductionEnv()),
  ENABLE_SOURCE_MAPS: getEnvVar('ENABLE_SOURCE_MAPS', !isProductionEnv()),

  // Security
  ENABLE_SECURITY_HEADERS: getEnvVar('ENABLE_SECURITY_HEADERS', isProductionEnv()),
  ENABLE_HTTPS_ENFORCEMENT: getEnvVar('ENABLE_HTTPS_ENFORCEMENT', isProductionEnv())
};

// Override global process.env if it doesn't exist (for compatibility)
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = {
    env: {
      NODE_ENV: getCurrentEnvironment()
    }
  };
}

export default PRODUCTION_ENV_CONFIG;