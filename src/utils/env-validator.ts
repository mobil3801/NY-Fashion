/**
 * Environment Variable Validator
 * Validates and sanitizes environment variables for production security
 */

import { logger } from '@/utils/production-logger';

export interface EnvValidationRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  sensitive?: boolean;
}

export interface EnvValidationConfig {
  [key: string]: EnvValidationRule;
}

class EnvironmentValidator {
  private validationRules: EnvValidationConfig;
  private validatedVars: Map<string, any> = new Map();

  constructor(rules: EnvValidationConfig) {
    this.validationRules = rules;
  }

  /**
   * Validate all environment variables according to rules
   */
  validateAll(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required variables
    Object.entries(this.validationRules).forEach(([varName, rule]) => {
      const value = import.meta.env[varName];

      if (rule.required && (!value || value.trim() === '')) {
        errors.push(`Required environment variable ${varName} is not set or empty`);
        return;
      }

      if (value) {
        const validation = this.validateVariable(varName, value, rule);
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
        warnings.push(...validation.warnings);
        
        if (validation.isValid) {
          this.validatedVars.set(varName, validation.value);
        }
      }
    });

    // Check for potentially dangerous variables in production
    if (import.meta.env.NODE_ENV === 'production') {
      this.checkProductionSafety(warnings, errors);
    }

    // Log validation results
    if (errors.length === 0) {
      logger.logInfo('Environment variable validation passed', {
        validatedCount: this.validatedVars.size,
        warningCount: warnings.length
      });
    } else {
      logger.logError('Environment variable validation failed', new Error(`Validation failed: ${errors.join(', ')}`));
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single environment variable
   */
  private validateVariable(name: string, value: string, rule: EnvValidationRule): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    value: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let processedValue: any = value;

    try {
      // Type validation and conversion
      switch (rule.type) {
        case 'number':
          processedValue = Number(value);
          if (isNaN(processedValue)) {
            errors.push(`${name} must be a valid number, got: ${value}`);
            return { isValid: false, errors, warnings, value };
          }
          break;

        case 'boolean':
          if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
            errors.push(`${name} must be a boolean value (true/false/1/0), got: ${value}`);
            return { isValid: false, errors, warnings, value };
          }
          processedValue = ['true', '1'].includes(value.toLowerCase());
          break;

        case 'url':
          try {
            new URL(value);
            if (import.meta.env.NODE_ENV === 'production' && !value.startsWith('https://')) {
              errors.push(`${name} must use HTTPS in production, got: ${value}`);
              return { isValid: false, errors, warnings, value };
            }
          } catch {
            errors.push(`${name} must be a valid URL, got: ${value}`);
            return { isValid: false, errors, warnings, value };
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`${name} must be a valid email address, got: ${value}`);
            return { isValid: false, errors, warnings, value };
          }
          break;
      }

      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${name} must be at least ${rule.minLength} characters long`);
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${name} must be no more than ${rule.maxLength} characters long`);
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${name} does not match required pattern`);
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(value)) {
        errors.push(`${name} must be one of: ${rule.allowedValues.join(', ')}, got: ${value}`);
      }

      // Security checks for sensitive variables
      if (rule.sensitive) {
        this.validateSensitiveVariable(name, value, warnings);
      }

    } catch (error) {
      errors.push(`Error validating ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: processedValue
    };
  }

  /**
   * Validate sensitive variables for security issues
   */
  private validateSensitiveVariable(name: string, value: string, warnings: string[]): void {
    // Check for common insecure values
    const insecurePatterns = [
      { pattern: /^(password|secret|key)$/i, message: 'appears to be a default placeholder' },
      { pattern: /^(test|demo|example)/, message: 'appears to contain test/demo values' },
      { pattern: /localhost|127\.0\.0\.1/, message: 'contains localhost references' },
      { pattern: /^.{1,5}$/, message: 'is suspiciously short for a sensitive value' },
      { pattern: /^(admin|root|user)$/i, message: 'uses a common default value' }
    ];

    insecurePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(value)) {
        warnings.push(`Sensitive variable ${name} ${message}`);
      }
    });

    // Check for proper entropy in secrets
    if (name.toLowerCase().includes('secret') || name.toLowerCase().includes('key')) {
      if (this.calculateEntropy(value) < 3.0) {
        warnings.push(`${name} has low entropy and may be easily guessable`);
      }
    }
  }

  /**
   * Calculate entropy of a string (basic implementation)
   */
  private calculateEntropy(str: string): number {
    const charCount = new Map<string, number>();
    for (const char of str) {
      charCount.set(char, (charCount.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of charCount.values()) {
      const probability = count / str.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check for production safety issues
   */
  private checkProductionSafety(warnings: string[], errors: string[]): void {
    // Check for development-specific values in production
    const devPatterns = [
      { env: 'VITE_API_BASE_URL', pattern: /localhost|127\.0\.0\.1/, message: 'API URL points to localhost in production' },
      { env: 'NODE_ENV', pattern: /^development$/i, message: 'NODE_ENV is set to development in production build' },
      { env: 'VITE_ENABLE_DEBUG', pattern: /^true$/i, message: 'Debug mode is enabled in production' }
    ];

    devPatterns.forEach(({ env, pattern, message }) => {
      const value = import.meta.env[env];
      if (value && pattern.test(value)) {
        if (env === 'NODE_ENV') {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    });

    // Check for missing production-required variables
    const productionRequired = [
      'VITE_API_BASE_URL',
      'NODE_ENV'
    ];

    productionRequired.forEach(varName => {
      if (!import.meta.env[varName]) {
        errors.push(`Production deployment missing required variable: ${varName}`);
      }
    });
  }

  /**
   * Get a validated environment variable
   */
  getValidatedVar<T = any>(name: string): T | undefined {
    return this.validatedVars.get(name) as T | undefined;
  }

  /**
   * Get all validated variables
   */
  getValidatedVars(): Map<string, any> {
    return new Map(this.validatedVars);
  }

  /**
   * Sanitize environment variables for logging
   */
  getSanitizedEnvForLogging(): Record<string, string> {
    const sanitized: Record<string, string> = {};

    Object.keys(import.meta.env).forEach(key => {
      const rule = this.validationRules[key];
      const value = import.meta.env[key];

      if (rule?.sensitive || this.isSensitiveKey(key)) {
        // Mask sensitive values
        sanitized[key] = value ? `${'*'.repeat(Math.min(value.length, 8))}` : 'unset';
      } else {
        sanitized[key] = value || 'unset';
      }
    });

    return sanitized;
  }

  /**
   * Check if a key is sensitive based on naming patterns
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
      /private/i,
      /auth/i,
      /_key$/i,
      /_secret$/i,
      /_token$/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  /**
   * Create a production-ready environment report
   */
  generateProductionReport(): {
    isProductionReady: boolean;
    criticalIssues: string[];
    warnings: string[];
    configuredVars: string[];
    missingOptionalVars: string[];
  } {
    const validation = this.validateAll();
    const criticalIssues = validation.errors;
    const warnings = validation.warnings;
    const configuredVars: string[] = [];
    const missingOptionalVars: string[] = [];

    Object.entries(this.validationRules).forEach(([varName, rule]) => {
      const value = import.meta.env[varName];
      
      if (value) {
        configuredVars.push(varName);
      } else if (!rule.required) {
        missingOptionalVars.push(varName);
      }
    });

    return {
      isProductionReady: criticalIssues.length === 0,
      criticalIssues,
      warnings,
      configuredVars,
      missingOptionalVars
    };
  }
}

// Default validation configuration
export const DEFAULT_ENV_VALIDATION_CONFIG: EnvValidationConfig = {
  NODE_ENV: {
    required: true,
    type: 'string',
    allowedValues: ['development', 'production', 'test']
  },
  VITE_API_BASE_URL: {
    required: false,
    type: 'url',
    sensitive: false
  },
  VITE_API_TIMEOUT: {
    required: false,
    type: 'number',
    minLength: 1
  },
  VITE_MAX_LOGIN_ATTEMPTS: {
    required: false,
    type: 'number',
    minLength: 1
  },
  VITE_SESSION_TIMEOUT: {
    required: false,
    type: 'number',
    minLength: 1
  },
  VITE_ENABLE_DEBUG: {
    required: false,
    type: 'boolean'
  },
  VITE_ENABLE_CONSOLE_LOGGING: {
    required: false,
    type: 'boolean'
  },
  VITE_API_KEY: {
    required: false,
    type: 'string',
    sensitive: true,
    minLength: 10
  },
  VITE_SECRET_KEY: {
    required: false,
    type: 'string',
    sensitive: true,
    minLength: 16
  }
};

// Create and export singleton instance
export const environmentValidator = new EnvironmentValidator(DEFAULT_ENV_VALIDATION_CONFIG);

export default environmentValidator;
