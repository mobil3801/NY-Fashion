
import { useEffect, useCallback } from 'react';
import { useCSPNonce } from '@/security/csp-nonce';
import { useSecurityHeaders } from '@/security/headers';
import { useSecurityAudit } from '@/security/audit-logging';
import { rateLimitManager } from '@/security/rate-limiting';
import { securityValidator } from '@/security/validation';
import { useAuth } from '@/contexts/AuthContext';

export const useSecurityIntegration = () => {
  const nonce = useCSPNonce();
  const { injectHeaders } = useSecurityHeaders();
  const {
    logAuthentication,
    logAuthorization,
    logSecurityViolation,
    logDataAccess
  } = useSecurityAudit();
  const { user } = useAuth();

  // Initialize security headers and CSP
  useEffect(() => {
    injectHeaders(nonce);
  }, [nonce, injectHeaders]);

  // Monitor API calls for rate limiting
  const checkRateLimit = useCallback((endpoint: string, clientId?: string) => {
    const identifier = clientId || getClientIdentifier();
    return rateLimitManager.checkRateLimit(identifier, endpoint);
  }, []);

  // Validate and sanitize input data
  const validateInput = useCallback((data: any, schema: any) => {
    return securityValidator.validate(data, schema);
  }, []);

  // Log security events
  const logSecurityEvent = useCallback((
  eventType: 'authentication' | 'authorization' | 'data_access' | 'security_violation',
  details: any) =>
  {
    switch (eventType) {
      case 'authentication':
        logAuthentication(details.userId, details.success, details);
        break;
      case 'authorization':
        logAuthorization(details.userId, details.resource, details.action, details.success, details);
        break;
      case 'data_access':
        logDataAccess(details.userId, details.resource, details.action, details.success, details);
        break;
      case 'security_violation':
        logSecurityViolation(details.source, details.violationType, details);
        break;
    }
  }, [logAuthentication, logAuthorization, logDataAccess, logSecurityViolation]);

  // Enhanced fetch wrapper with security features
  const secureApiCall = useCallback(async (
  url: string,
  options: RequestInit & {
    skipRateLimit?: boolean;
    skipValidation?: boolean;
    validationSchema?: any;
  } = {}) =>
  {
    const {
      skipRateLimit = false,
      skipValidation = false,
      validationSchema,
      ...fetchOptions
    } = options;

    try {
      // Rate limiting check
      if (!skipRateLimit) {
        const rateLimitResult = checkRateLimit(url);
        if (!rateLimitResult.success) {
          const error = new Error('Rate limit exceeded');
          logSecurityEvent('security_violation', {
            source: getClientIdentifier(),
            violationType: 'rate_limit_exceeded',
            url,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime
          });
          throw error;
        }
      }

      // Input validation
      if (!skipValidation && validationSchema && fetchOptions.body) {
        try {
          const data = JSON.parse(fetchOptions.body as string);
          const validation = validateInput(data, validationSchema);

          if (!validation.valid) {
            logSecurityEvent('security_violation', {
              source: getClientIdentifier(),
              violationType: 'invalid_input',
              url,
              errors: validation.errors
            });
            throw new Error(`Input validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
          }

          // Use sanitized data
          fetchOptions.body = JSON.stringify(validation.sanitizedData);
        } catch (parseError) {

          // If body is not JSON, skip validation
        }}

      // Add security headers
      const securityHeaders = {
        'X-CSP-Nonce': nonce,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client-ID': getClientIdentifier(),
        ...fetchOptions.headers
      };

      const response = await fetch(url, {
        ...fetchOptions,
        headers: securityHeaders
      });

      // Log successful data access
      if (user) {
        logSecurityEvent('data_access', {
          userId: user.ID?.toString(),
          resource: url,
          action: fetchOptions.method || 'GET',
          success: response.ok
        });
      }

      return response;

    } catch (error) {
      // Log failed request
      if (user) {
        logSecurityEvent('data_access', {
          userId: user.ID?.toString(),
          resource: url,
          action: fetchOptions.method || 'GET',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }, [checkRateLimit, validateInput, logSecurityEvent, nonce, user]);

  // Monitor for security violations in form inputs
  const monitorInput = useCallback((value: string, fieldName: string) => {
    if (securityValidator.detectSQLInjection(value)) {
      logSecurityEvent('security_violation', {
        source: getClientIdentifier(),
        violationType: 'sql_injection_attempt',
        fieldName,
        value: value.substring(0, 100) // Log first 100 chars only
      });
      return false;
    }

    if (securityValidator.detectXSS(value)) {
      logSecurityEvent('security_violation', {
        source: getClientIdentifier(),
        violationType: 'xss_attempt',
        fieldName,
        value: value.substring(0, 100)
      });
      return false;
    }

    if (securityValidator.detectCommandInjection(value)) {
      logSecurityEvent('security_violation', {
        source: getClientIdentifier(),
        violationType: 'command_injection_attempt',
        fieldName,
        value: value.substring(0, 100)
      });
      return false;
    }

    return true;
  }, [logSecurityEvent]);

  // Security event handlers
  const onLogin = useCallback((email: string, success: boolean, error?: string) => {
    logSecurityEvent('authentication', {
      userId: email,
      success,
      error,
      timestamp: new Date().toISOString()
    });
  }, [logSecurityEvent]);

  const onResourceAccess = useCallback((resource: string, action: string, success: boolean) => {
    if (user) {
      logSecurityEvent('authorization', {
        userId: user.ID?.toString(),
        resource,
        action,
        success
      });
    }
  }, [logSecurityEvent, user]);

  return {
    nonce,
    checkRateLimit,
    validateInput,
    secureApiCall,
    monitorInput,
    logSecurityEvent,
    onLogin,
    onResourceAccess,
    // Utility functions
    sanitizeString: securityValidator.sanitizeString.bind(securityValidator),
    isSecureInput: (input: string) =>
    !securityValidator.detectSQLInjection(input) &&
    !securityValidator.detectXSS(input) &&
    !securityValidator.detectCommandInjection(input)
  };
};

// Utility function to get client identifier
const getClientIdentifier = (): string => {
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem('client_security_id');
    if (stored) return stored;
  }

  // Generate client fingerprint
  const fingerprint = [
  navigator.userAgent,
  navigator.language,
  screen.width + 'x' + screen.height,
  new Date().getTimezoneOffset(),
  navigator.hardwareConcurrency || 'unknown',
  navigator.platform].
  join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const clientId = Math.abs(hash).toString(36).substring(0, 12);

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('client_security_id', clientId);
  }

  return clientId;
};