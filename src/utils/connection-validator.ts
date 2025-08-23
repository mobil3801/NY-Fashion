/**
 * Connection Validator Utility
 * Validates all connection strings and configurations for production deployment
 */

import { ENHANCED_PRODUCTION_CONFIG } from '@/config/enhanced-production';
import { logger } from '@/utils/production-logger';

export interface ConnectionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  score: number;
}

export interface DatabaseConnectionTest {
  success: boolean;
  responseTime: number;
  error?: string;
  connectionInfo?: {
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
  };
}

export interface APIEndpointTest {
  endpoint: string;
  success: boolean;
  responseTime: number;
  status?: number;
  error?: string;
}

class ConnectionValidator {
  private validationResults: ConnectionValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    recommendations: [],
    score: 0
  };

  /**
   * Validate all connection configurations
   */
  async validateAllConnections(): Promise<ConnectionValidationResult> {
    logger.logInfo('Starting comprehensive connection validation');

    this.validationResults = {
      isValid: false,
      errors: [],
      warnings: [],
      recommendations: [],
      score: 0
    };

    try {
      // 1. Validate environment configuration
      this.validateEnvironmentConfiguration();

      // 2. Validate API endpoints
      await this.validateAPIEndpoints();

      // 3. Validate database connections
      await this.validateDatabaseConnections();

      // 4. Validate network configuration
      this.validateNetworkConfiguration();

      // 5. Validate security configuration
      this.validateSecurityConfiguration();

      // 6. Validate file upload configuration
      this.validateFileUploadConfiguration();

      // Calculate overall score
      this.calculateValidationScore();

      logger.logInfo('Connection validation completed', {
        score: this.validationResults.score,
        errors: this.validationResults.errors.length,
        warnings: this.validationResults.warnings.length
      });

      return this.validationResults;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      this.validationResults.errors.push(`Validation failed: ${errorMessage}`);
      logger.logError('Connection validation failed', error);
      return this.validationResults;
    }
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironmentConfiguration(): void {
    const config = ENHANCED_PRODUCTION_CONFIG;

    // Check NODE_ENV
    if (import.meta.env.NODE_ENV === 'production') {
      if (config.development.enableDebugMode) {
        this.validationResults.errors.push('Debug mode must be disabled in production');
      }

      if (config.development.enableConsoleLogging) {
        this.validationResults.warnings.push('Console logging should be disabled in production');
      }

      if (config.development.enableSourceMaps) {
        this.validationResults.warnings.push('Source maps should be disabled in production');
      }
    }

    // Validate required environment variables
    const requiredVars = [
    'VITE_API_BASE_URL',
    'VITE_HEARTBEAT_INTERVAL_MS',
    'VITE_HEARTBEAT_TIMEOUT_MS'];


    requiredVars.forEach((varName) => {
      const value = import.meta.env[varName];
      if (!value) {
        this.validationResults.warnings.push(`Environment variable ${varName} not set, using default`);
      }
    });

    // Validate API base URL
    const apiBaseUrl = config.api.baseUrl;
    if (import.meta.env.NODE_ENV === 'production' && !apiBaseUrl.startsWith('https://')) {
      this.validationResults.errors.push('Production API must use HTTPS protocol');
    }

    if (apiBaseUrl === 'http://localhost' || apiBaseUrl.includes('127.0.0.1')) {
      this.validationResults.warnings.push('API base URL appears to be localhost - ensure this is correct for production');
    }
  }

  /**
   * Validate API endpoints
   */
  private async validateAPIEndpoints(): Promise<void> {
    const config = ENHANCED_PRODUCTION_CONFIG;
    const baseUrl = config.api.baseUrl;

    const criticalEndpoints = [
    { path: '/', description: 'Root endpoint' },
    { path: '/api/health', description: 'Health check endpoint' },
    { path: config.api.healthUrl, description: 'Configured health endpoint' }];


    const endpointTests: APIEndpointTest[] = [];

    for (const endpoint of criticalEndpoints) {
      const fullUrl = `${baseUrl}${endpoint.path}`;

      try {
        const startTime = performance.now();

        // Use HEAD request to avoid large responses
        const response = await fetch(fullUrl, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(config.api.timeout)
        });

        const responseTime = performance.now() - startTime;

        endpointTests.push({
          endpoint: fullUrl,
          success: response.ok,
          responseTime,
          status: response.status
        });

        if (!response.ok) {
          this.validationResults.warnings.push(
            `Endpoint ${endpoint.description} returned status ${response.status}`
          );
        }

        if (responseTime > config.monitoring.alertThresholds.apiResponseTime) {
          this.validationResults.warnings.push(
            `Endpoint ${endpoint.description} response time (${responseTime}ms) exceeds threshold`
          );
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        endpointTests.push({
          endpoint: fullUrl,
          success: false,
          responseTime: 0,
          error: errorMessage
        });

        // Don't treat connectivity errors as critical in validation
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          this.validationResults.warnings.push(
            `Could not connect to ${endpoint.description}: ${errorMessage}`
          );
        } else {
          this.validationResults.errors.push(
            `Endpoint validation failed for ${endpoint.description}: ${errorMessage}`
          );
        }
      }
    }

    logger.logInfo('API endpoint validation completed', { tests: endpointTests });
  }

  /**
   * Validate database connections
   */
  private async validateDatabaseConnections(): Promise<void> {
    try {
      // Test basic EasySite database connectivity
      const dbTest = await this.testDatabaseConnection();

      if (!dbTest.success) {
        this.validationResults.errors.push(`Database connection failed: ${dbTest.error}`);
      } else {
        if (dbTest.responseTime > 1000) {
          this.validationResults.warnings.push(
            `Database response time (${dbTest.responseTime}ms) is high`
          );
        }

        // Validate connection pool configuration
        const config = ENHANCED_PRODUCTION_CONFIG.database;

        if (config.connectionPoolSize < 5) {
          this.validationResults.warnings.push('Connection pool size is very small for production');
        }

        if (config.queryTimeout < 10000) {
          this.validationResults.warnings.push('Query timeout is very short for production');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.validationResults.errors.push(`Database validation failed: ${errorMessage}`);
    }
  }

  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<DatabaseConnectionTest> {
    const startTime = performance.now();

    try {
      // Test basic query through EasySite API
      const result = await window.ezsite.db.query('SELECT 1 as test', []);
      const responseTime = performance.now() - startTime;

      if (!result || result.length === 0) {
        return {
          success: false,
          responseTime,
          error: 'Database query returned no results'
        };
      }

      return {
        success: true,
        responseTime,
        connectionInfo: {
          poolSize: ENHANCED_PRODUCTION_CONFIG.database.connectionPoolSize,
          activeConnections: Math.floor(Math.random() * 5) + 1, // Simulated
          idleConnections: Math.floor(Math.random() * 10) + 5 // Simulated
        }
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validate network configuration
   */
  private validateNetworkConfiguration(): void {
    const config = ENHANCED_PRODUCTION_CONFIG.network;

    // Validate heartbeat intervals
    if (config.heartbeatInterval < 10000) {
      this.validationResults.warnings.push('Heartbeat interval is very frequent, may cause unnecessary load');
    }

    if (config.heartbeatInterval > 300000) {
      this.validationResults.warnings.push('Heartbeat interval is very long, may delay failure detection');
    }

    if (config.heartbeatTimeout >= config.heartbeatInterval) {
      this.validationResults.errors.push('Heartbeat timeout should be less than heartbeat interval');
    }

    // Validate retry configuration
    if (config.maxRetries > 10) {
      this.validationResults.warnings.push('Max retries is very high, may cause long delays');
    }

    if (config.baseDelay > 5000) {
      this.validationResults.warnings.push('Base retry delay is very long');
    }
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfiguration(): void {
    const config = ENHANCED_PRODUCTION_CONFIG.security;

    // Check HTTPS enforcement
    if (import.meta.env.NODE_ENV === 'production' && !config.enableCSRF) {
      this.validationResults.warnings.push('CSRF protection should be enabled in production');
    }

    if (!config.enableContentSecurityPolicy) {
      this.validationResults.warnings.push('Content Security Policy should be enabled');
    }

    if (!config.enableSecurityHeaders) {
      this.validationResults.warnings.push('Security headers should be enabled');
    }

    if (!config.enableRateLimit) {
      this.validationResults.warnings.push('Rate limiting should be enabled');
    }

    // Validate session timeout
    if (config.sessionTimeout > 86400000) {// 24 hours
      this.validationResults.warnings.push('Session timeout is very long');
    }

    if (config.sessionTimeout < 900000) {// 15 minutes
      this.validationResults.warnings.push('Session timeout is very short');
    }

    // Validate login attempts
    if (config.maxLoginAttempts > 10) {
      this.validationResults.warnings.push('Max login attempts is high');
    }

    if (config.maxLoginAttempts < 3) {
      this.validationResults.warnings.push('Max login attempts is very low');
    }
  }

  /**
   * Validate file upload configuration
   */
  private validateFileUploadConfiguration(): void {
    const config = ENHANCED_PRODUCTION_CONFIG.fileUpload;

    // Validate file size limits
    const maxSizeMB = config.maxFileSize / (1024 * 1024);

    if (maxSizeMB > 50) {
      this.validationResults.warnings.push('File size limit is very high (>50MB)');
    }

    if (maxSizeMB < 1) {
      this.validationResults.warnings.push('File size limit is very low (<1MB)');
    }

    // Validate allowed file types
    const allowedTypes = config.allowedTypes;

    if (allowedTypes.includes('application/javascript') ||
    allowedTypes.includes('text/html') ||
    allowedTypes.includes('application/x-executable')) {
      this.validationResults.errors.push('Potentially dangerous file types are allowed');
    }

    // Check for security features
    if (!config.enableImageCompression) {
      this.validationResults.recommendations.push('Enable image compression to reduce storage usage');
    }

    if (config.imageQuality > 0.9) {
      this.validationResults.recommendations.push('Consider reducing image quality to save storage');
    }
  }

  /**
   * Calculate overall validation score
   */
  private calculateValidationScore(): void {
    const errors = this.validationResults.errors.length;
    const warnings = this.validationResults.warnings.length;

    // Start with perfect score
    let score = 100;

    // Deduct points for errors and warnings
    score -= errors * 20; // 20 points per error
    score -= warnings * 5; // 5 points per warning

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    // Determine if configuration is valid
    this.validationResults.isValid = errors === 0;
    this.validationResults.score = score;

    // Add recommendations based on score
    if (score < 70) {
      this.validationResults.recommendations.push(
        'Configuration has significant issues that should be addressed before production deployment'
      );
    } else if (score < 90) {
      this.validationResults.recommendations.push(
        'Configuration is mostly good but has some areas for improvement'
      );
    } else {
      this.validationResults.recommendations.push(
        'Configuration looks good for production deployment'
      );
    }
  }

  /**
   * Generate a validation report
   */
  generateReport(): string {
    const result = this.validationResults;
    const timestamp = new Date().toISOString();

    return `
# Connection Validation Report

**Generated**: ${timestamp}
**Overall Score**: ${result.score}/100
**Status**: ${result.isValid ? '✅ VALID' : '❌ INVALID'}

## Summary
- **Errors**: ${result.errors.length}
- **Warnings**: ${result.warnings.length}
- **Recommendations**: ${result.recommendations.length}

## Errors
${result.errors.length > 0 ? result.errors.map((error) => `- ❌ ${error}`).join('\n') : '✅ No errors found'}

## Warnings
${result.warnings.length > 0 ? result.warnings.map((warning) => `- ⚠️ ${warning}`).join('\n') : '✅ No warnings found'}

## Recommendations
${result.recommendations.length > 0 ? result.recommendations.map((rec) => `- 💡 ${rec}`).join('\n') : '✅ No additional recommendations'}

---
*Generated by Connection Validator v1.0*
    `.trim();
  }
}

// Export singleton instance
export const connectionValidator = new ConnectionValidator();

// Utility functions
export const validateConnections = () => connectionValidator.validateAllConnections();
export const generateValidationReport = () => connectionValidator.generateReport();

export default connectionValidator;