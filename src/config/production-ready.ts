
/**
 * Production-Ready Configuration
 * Final configuration for production deployment
 */

import { PRODUCTION_CONFIG } from './production';
import { SECURITY_CONFIG } from './security';

export const PRODUCTION_READY_CONFIG = {
  ...PRODUCTION_CONFIG,

  // Enhanced Production Settings
  api: {
    ...PRODUCTION_CONFIG.api,
    enableCaching: true,
    enableCompression: true,
    enableRequestDeduplication: true
  },

  // Performance Optimizations
  performance: {
    ...PRODUCTION_CONFIG.performance,
    enableLazyLoading: true,
    enableCodeSplitting: true,
    enablePreloading: true,
    enableMinification: true,
    enableTreeShaking: true,
    bundleAnalyzer: false // Disabled in production
  },

  // Security Hardening
  security: {
    ...PRODUCTION_CONFIG.security,
    ...SECURITY_CONFIG,
    enableStrictCSP: true,
    enableHSTS: true,
    enableXSSProtection: true,
    enableFrameOptions: true,
    enableReferrerPolicy: true
  },

  // Debug and Development Features - DISABLED
  development: {
    enableDebugMode: false,
    enableMockData: false,
    enableTestingTools: false,
    enableConsoleLogging: false,
    enableSourceMaps: false,
    enableDevTools: false,
    enableHotReload: false
  },

  // Feature Flags for Production
  features: {
    ...PRODUCTION_CONFIG.features,
    enableDebugPanels: false,
    enableTestingPages: false,
    enablePerformanceMonitoring: true,
    enableErrorTracking: true,
    enableSecurityMonitoring: true
  },

  // Build Configuration
  build: {
    enableMinification: true,
    enableCompression: true,
    enableSplitChunks: true,
    enableTreeShaking: true,
    removeConsoleLog: true,
    removeDebugger: true,
    optimizeDependencies: true,
    generateSourceMap: false
  },

  // Monitoring Configuration
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    enableRealTimeMonitoring: true,
    enableAutomaticReporting: true,
    enablePerformanceTracking: true,
    enableUserExperienceTracking: false, // Privacy-focused
    enableDetailedErrorReporting: true
  }
} as const;

// Export configuration based on environment
export const getConfig = () => {
  const isProd = process.env.NODE_ENV === 'production' ||
  import.meta.env.PROD ||
  import.meta.env.NODE_ENV === 'production';

  if (isProd) {
    return PRODUCTION_READY_CONFIG;
  }

  // Development fallback with minimal debug features
  return {
    ...PRODUCTION_READY_CONFIG,
    development: {
      ...PRODUCTION_READY_CONFIG.development,
      enableConsoleLogging: true,
      enableSourceMaps: true
    }
  };
};

export default PRODUCTION_READY_CONFIG;