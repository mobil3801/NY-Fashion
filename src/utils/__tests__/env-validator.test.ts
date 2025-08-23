
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  environmentValidator,
  getEnvironment,
  isDevelopment,
  isProduction,
  getEnvVar,
  getEnvironmentConfig
} from '../env-validator';

// Mock import.meta.env
const mockEnv = {
  NODE_ENV: 'test',
  MODE: 'test',
  DEV: false,
  PROD: false,
  VITE_API_BASE_URL: 'http://localhost:3000',
  VITE_ENABLE_DEBUG: 'true'
};

vi.mock('import.meta', () => ({
  env: mockEnv
}));

describe('Environment Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock environment
    Object.assign(mockEnv, {
      NODE_ENV: 'test',
      MODE: 'test',
      DEV: false,
      PROD: false
    });

    // Reset console spies
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('environment detection', () => {
    it('should detect development environment', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.DEV = true;
      
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(getEnvironment()).toBe('development');
    });

    it('should detect production environment', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
      expect(getEnvironment()).toBe('production');
    });

    it('should default to production when NODE_ENV is not set', () => {
      delete mockEnv.NODE_ENV;
      delete mockEnv.MODE;
      mockEnv.DEV = false;
      mockEnv.PROD = false;
      
      expect(getEnvironment()).toBe('production');
      expect(isProduction()).toBe(true);
    });

    it('should handle window.__NODE_ENV__ override', () => {
      Object.defineProperty(window, '__NODE_ENV__', {
        value: 'development',
        writable: true
      });
      
      expect(getEnvironment()).toBe('development');
      
      delete (window as any).__NODE_ENV__;
    });
  });

  describe('environment validation', () => {
    it('should validate successfully with proper configuration', () => {
      mockEnv.NODE_ENV = 'development';
      
      const validation = environmentValidator.validateAll();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.environment).toBe('development');
    });

    it('should handle validation errors gracefully', () => {
      // Mock a scenario that might cause validation to throw
      const originalDefineProperty = Object.defineProperty;
      Object.defineProperty = vi.fn(() => {
        throw new Error('Cannot define property');
      });
      
      const validation = environmentValidator.validateAll();
      
      expect(validation.isValid).toBe(true); // Should still be valid due to error handling
      expect(validation.warnings.length).toBeGreaterThan(0);
      
      // Restore
      Object.defineProperty = originalDefineProperty;
    });

    it('should warn about HTTPS in production', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      // Mock location to simulate HTTP in production
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'example.com'
        },
        writable: true
      });
      
      const validation = environmentValidator.validateAll();
      
      expect(validation.warnings).toContain('Production should use HTTPS');
    });

    it('should not warn about HTTP on localhost', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: 'localhost'
        },
        writable: true
      });
      
      const validation = environmentValidator.validateAll();
      
      expect(validation.warnings.find(w => w.includes('HTTPS'))).toBeUndefined();
    });
  });

  describe('configuration management', () => {
    it('should provide complete environment configuration', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.VITE_API_BASE_URL = 'http://localhost:8080';
      mockEnv.VITE_API_TIMEOUT = '5000';
      
      const config = getEnvironmentConfig();
      
      expect(config).toHaveProperty('NODE_ENV', 'development');
      expect(config).toHaveProperty('API_BASE_URL', 'http://localhost:8080');
      expect(config).toHaveProperty('API_TIMEOUT', 5000);
      expect(config).toHaveProperty('ENABLE_DEBUG', true);
    });

    it('should provide fallback values for missing environment variables', () => {
      mockEnv.NODE_ENV = 'production';
      delete mockEnv.VITE_API_BASE_URL;
      delete mockEnv.VITE_API_TIMEOUT;
      
      const config = getEnvironmentConfig();
      
      expect(config.API_BASE_URL).toBe(window.location.origin);
      expect(config.API_TIMEOUT).toBe(30000);
      expect(config.ENABLE_DEBUG).toBe(false);
    });

    it('should handle numeric environment variables correctly', () => {
      mockEnv.VITE_API_TIMEOUT = '15000';
      mockEnv.VITE_API_RETRY_COUNT = '5';
      mockEnv.VITE_MAX_LOGIN_ATTEMPTS = '3';
      
      const config = getEnvironmentConfig();
      
      expect(config.API_TIMEOUT).toBe(15000);
      expect(config.API_RETRY_COUNT).toBe(5);
      expect(config.MAX_LOGIN_ATTEMPTS).toBe(3);
    });

    it('should handle boolean environment variables correctly', () => {
      mockEnv.VITE_ENABLE_DEBUG = 'true';
      mockEnv.VITE_ENABLE_CONSOLE_LOGGING = 'false';
      mockEnv.VITE_DISABLE_DEBUG_ROUTES = 'true';
      
      const config = getEnvironmentConfig();
      
      expect(config.ENABLE_DEBUG).toBe(true);
      expect(config.ENABLE_CONSOLE_LOGGING).toBe(false);
      expect(config.DISABLE_DEBUG_ROUTES).toBe(true);
    });
  });

  describe('environment variable getter', () => {
    it('should get environment variable with fallback', () => {
      mockEnv.VITE_CUSTOM_VALUE = 'test-value';
      
      expect(getEnvVar('CUSTOM_VALUE')).toBe('test-value');
      expect(getEnvVar('VITE_CUSTOM_VALUE')).toBe('test-value');
      expect(getEnvVar('NON_EXISTENT', 'fallback')).toBe('fallback');
      expect(getEnvVar('NON_EXISTENT')).toBeUndefined();
    });
  });

  describe('production-specific configuration', () => {
    it('should disable debug features in production', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      const config = getEnvironmentConfig();
      
      expect(config.ENABLE_DEBUG).toBe(false);
      expect(config.ENABLE_CONSOLE_LOGGING).toBe(false);
      expect(config.DISABLE_DEBUG_ROUTES).toBe(true);
      expect(config.DISABLE_DEBUG_PROVIDER).toBe(true);
    });

    it('should enable debug features in development', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.DEV = true;
      
      const config = getEnvironmentConfig();
      
      expect(config.ENABLE_DEBUG).toBe(true);
      expect(config.ENABLE_CONSOLE_LOGGING).toBe(true);
      expect(config.DISABLE_DEBUG_ROUTES).toBe(false);
      expect(config.DISABLE_DEBUG_PROVIDER).toBe(false);
    });

    it('should use stricter security settings in production', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      const config = getEnvironmentConfig();
      
      expect(config.MAX_LOGIN_ATTEMPTS).toBe(5);
      expect(config.SESSION_TIMEOUT).toBe(3600000); // 1 hour
      expect(config.ENABLE_SECURITY_HEADERS).toBe(true);
    });

    it('should use relaxed settings in development', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.DEV = true;
      
      const config = getEnvironmentConfig();
      
      expect(config.MAX_LOGIN_ATTEMPTS).toBe(10);
      expect(config.SESSION_TIMEOUT).toBe(7200000); // 2 hours
    });
  });

  describe('error handling and safety', () => {
    it('should handle readonly property errors when setting NODE_ENV', () => {
      // Mock window with readonly __NODE_ENV__
      Object.defineProperty(window, '__NODE_ENV__', {
        value: 'test',
        writable: false,
        configurable: false
      });
      
      expect(() => {
        environmentValidator.validateAll();
      }).not.toThrow();
    });

    it('should provide safe defaults when validation fails', () => {
      // Mock getEnvironmentConfig to throw
      const original = environmentValidator.validateAll;
      environmentValidator.validateAll = vi.fn(() => {
        throw new Error('Validation failed');
      });
      
      const validation = environmentValidator.validateAll();
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      
      // Restore
      environmentValidator.validateAll = original;
    });

    it('should not log in production unless there are warnings', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PROD = true;
      
      environmentValidator.validateAll();
      
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should log configuration in development', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.DEV = true;
      
      environmentValidator.validateAll();
      
      expect(console.log).toHaveBeenCalledWith(
        'Environment Configuration:',
        expect.any(Object)
      );
    });
  });

  describe('backwards compatibility', () => {
    it('should maintain compatibility with legacy method calls', () => {
      expect(typeof environmentValidator.getEnvironment).toBe('function');
      expect(typeof environmentValidator.isDevelopment).toBe('function');
      expect(typeof environmentValidator.isProduction).toBe('function');
      expect(typeof environmentValidator.getEnvVar).toBe('function');
    });

    it('should export utility functions', () => {
      expect(typeof getEnvironment).toBe('function');
      expect(typeof isDevelopment).toBe('function');
      expect(typeof isProduction).toBe('function');
      expect(typeof getEnvVar).toBe('function');
      expect(typeof getEnvironmentConfig).toBe('function');
    });
  });
});
