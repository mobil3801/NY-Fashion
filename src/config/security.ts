/**
 * Comprehensive Security Configuration
 * Implements production-ready security measures including HTTPS enforcement,
 * security headers, and environment variable validation
 */

export interface SecurityConfig {
  https: {
    enforceHttps: boolean;
    hstsEnabled: boolean;
    hstsMaxAge: number;
    hstsIncludeSubDomains: boolean;
    hstsPreload: boolean;
  };
  headers: {
    enableCSP: boolean;
    enableFrameOptions: boolean;
    enableContentTypeOptions: boolean;
    enableXSSProtection: boolean;
    enableReferrerPolicy: boolean;
    cspDirectives: Record<string, string[]>;
    frameOptions: string;
    referrerPolicy: string;
  };
  authentication: {
    maxLoginAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    requireSecureCookies: boolean;
    enableCSRF: boolean;
  };
  debug: {
    disableInProduction: boolean;
    removeDebugRoutes: boolean;
    disableDebugPanels: boolean;
    secureLogging: boolean;
  };
  environment: {
    requiredVars: string[];
    sensitiveVars: string[];
    validationRules: Record<string, (value: string) => boolean>;
  };
}

export const SECURITY_CONFIG: SecurityConfig = {
  https: {
    enforceHttps: import.meta.env.NODE_ENV === 'production',
    hstsEnabled: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: true
  },
  headers: {
    enableCSP: true,
    enableFrameOptions: true,
    enableContentTypeOptions: true,
    enableXSSProtection: true,
    enableReferrerPolicy: true,
    cspDirectives: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for React
        "'unsafe-eval'", // Required for React DevTools in development
        'https://cdn.ezsite.ai',
        ...(import.meta.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : [])
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled components
        'https://fonts.googleapis.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:'
      ],
      'connect-src': [
        "'self'",
        'https://api.ezsite.ai',
        'wss://api.ezsite.ai',
        ...(import.meta.env.NODE_ENV === 'development' ? ['ws://localhost:*', 'http://localhost:*'] : [])
      ],
      'font-src': [
        "'self'",
        'data:',
        'https://fonts.gstatic.com'
      ],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    },
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin'
  },
  authentication: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    sessionTimeout: 60 * 60 * 1000, // 1 hour
    requireSecureCookies: import.meta.env.NODE_ENV === 'production',
    enableCSRF: true
  },
  debug: {
    disableInProduction: true,
    removeDebugRoutes: import.meta.env.NODE_ENV === 'production',
    disableDebugPanels: import.meta.env.NODE_ENV === 'production',
    secureLogging: import.meta.env.NODE_ENV === 'production'
  },
  environment: {
    requiredVars: [
      // Add required environment variables here
      'NODE_ENV'
    ],
    sensitiveVars: [
      'VITE_API_KEY',
      'VITE_DATABASE_URL',
      'VITE_SECRET_KEY'
    ],
    validationRules: {
      NODE_ENV: (value: string) => ['development', 'production', 'test'].includes(value),
      VITE_API_TIMEOUT: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
      VITE_MAX_LOGIN_ATTEMPTS: (value: string) => !isNaN(Number(value)) && Number(value) > 0
    }
  }
};

/**
 * Validates environment variables according to security requirements
 */
export const validateEnvironmentVariables = (): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of SECURITY_CONFIG.environment.requiredVars) {
    if (!import.meta.env[varName]) {
      errors.push(`Required environment variable ${varName} is not set`);
    }
  }

  // Validate variable formats
  for (const [varName, validator] of Object.entries(SECURITY_CONFIG.environment.validationRules)) {
    const value = import.meta.env[varName];
    if (value && !validator(value)) {
      errors.push(`Invalid value for environment variable ${varName}: ${value}`);
    }
  }

  // Check for sensitive variables in production
  if (import.meta.env.NODE_ENV === 'production') {
    for (const varName of SECURITY_CONFIG.environment.sensitiveVars) {
      const value = import.meta.env[varName];
      if (value && (value.includes('localhost') || value.includes('127.0.0.1') || value === 'development' || value === 'test')) {
        warnings.push(`Sensitive environment variable ${varName} appears to contain development values in production`);
      }
    }

    // Ensure HTTPS is enforced in production
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
      errors.push('API base URL must use HTTPS in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Generates Content Security Policy header value
 */
export const generateCSPHeader = (): string => {
  const directives = SECURITY_CONFIG.headers.cspDirectives;
  const cspParts = Object.entries(directives).map(([directive, sources]) => {
    return `${directive} ${sources.join(' ')}`;
  });
  return cspParts.join('; ');
};

/**
 * Security audit function to check for common vulnerabilities
 */
export const performSecurityAudit = (): { passed: boolean; issues: string[]; recommendations: string[] } => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if debug mode is disabled in production
  if (import.meta.env.NODE_ENV === 'production') {
    if (import.meta.env.VITE_ENABLE_DEBUG === 'true') {
      issues.push('Debug mode is enabled in production');
    }

    if (import.meta.env.VITE_ENABLE_CONSOLE_LOGGING === 'true') {
      issues.push('Console logging is enabled in production');
    }

    if (import.meta.env.VITE_ENABLE_SOURCE_MAPS === 'true') {
      recommendations.push('Source maps should be disabled in production for security');
    }
  }

  // Check for secure cookie settings
  if (SECURITY_CONFIG.authentication.requireSecureCookies && !window.location.protocol.startsWith('https:')) {
    issues.push('Secure cookies are required but site is not served over HTTPS');
  }

  // Check for CSRF protection
  if (!SECURITY_CONFIG.authentication.enableCSRF) {
    issues.push('CSRF protection should be enabled');
  }

  return {
    passed: issues.length === 0,
    issues,
    recommendations
  };
};

/**
 * Initialize security configurations
 */
export const initializeSecurity = (): void => {
  // Validate environment variables on startup
  const envValidation = validateEnvironmentVariables();
  
  if (!envValidation.isValid) {
    console.error('Security: Environment validation failed:', envValidation.errors);
    if (import.meta.env.NODE_ENV === 'production') {
      throw new Error(`Security validation failed: ${envValidation.errors.join(', ')}`);
    }
  }

  if (envValidation.warnings.length > 0) {
    console.warn('Security warnings:', envValidation.warnings);
  }

  // Perform security audit
  const securityAudit = performSecurityAudit();
  if (!securityAudit.passed) {
    console.error('Security audit failed:', securityAudit.issues);
    if (import.meta.env.NODE_ENV === 'production') {
      throw new Error(`Security audit failed: ${securityAudit.issues.join(', ')}`);
    }
  }

  if (securityAudit.recommendations.length > 0) {
    console.warn('Security recommendations:', securityAudit.recommendations);
  }

  console.log('Security configuration initialized successfully');
};

export default SECURITY_CONFIG;
