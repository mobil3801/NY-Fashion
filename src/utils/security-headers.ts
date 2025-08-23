/**
 * Security Headers Manager
 * Implements client-side security header management and CSP enforcement
 */

import { SECURITY_CONFIG, generateCSPHeader } from '@/config/security';
import { logger } from '@/utils/production-logger';

export interface SecurityHeadersConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableFrameOptions: boolean;
  enableContentTypeOptions: boolean;
  enableXSSProtection: boolean;
  enableReferrerPolicy: boolean;
  reportViolations: boolean;
}

class SecurityHeadersManager {
  private config: SecurityHeadersConfig;
  private violationCount: number = 0;

  constructor(config: SecurityHeadersConfig) {
    this.config = config;
  }

  /**
   * Initialize security headers
   */
  initialize(): void {
    this.setupClientSideHeaders();
    this.setupViolationReporting();
    this.auditExistingHeaders();

    logger.logSecurityEvent('security_headers_initialized', 'SYSTEM', 'INFO');
  }

  /**
   * Set up client-side security headers (meta tags)
   */
  private setupClientSideHeaders(): void {
    // Content Security Policy
    if (this.config.enableCSP) {
      this.setMetaHeader('Content-Security-Policy', generateCSPHeader());
    }

    // X-Frame-Options
    if (this.config.enableFrameOptions) {
      this.setMetaHeader('X-Frame-Options', SECURITY_CONFIG.headers.frameOptions);
    }

    // X-Content-Type-Options
    if (this.config.enableContentTypeOptions) {
      this.setMetaHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection
    if (this.config.enableXSSProtection) {
      this.setMetaHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (this.config.enableReferrerPolicy) {
      this.setMetaHeader('Referrer-Policy', SECURITY_CONFIG.headers.referrerPolicy);
    }

    // Permissions Policy (Feature Policy)
    this.setMetaHeader('Permissions-Policy', this.generatePermissionsPolicy());
  }

  /**
   * Set a security meta header
   */
  private setMetaHeader(name: string, content: string): void {
    const existingMeta = document.querySelector(`meta[http-equiv="${name}"]`);

    if (existingMeta) {
      existingMeta.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.httpEquiv = name;
      meta.content = content;
      document.head.appendChild(meta);
    }

    logger.logInfo(`Security header set: ${name}`);
  }

  /**
   * Generate Permissions Policy header value
   */
  private generatePermissionsPolicy(): string {
    const policies = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=(self)',
    'encrypted-media=(self)',
    'fullscreen=(self)',
    'picture-in-picture=()'];


    return policies.join(', ');
  }

  /**
   * Set up CSP violation reporting
   */
  private setupViolationReporting(): void {
    if (!this.config.reportViolations) return;

    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleCSPViolation(event);
    });

    // Listen for other security violations
    window.addEventListener('error', (event) => {
      if (this.isSecurityRelatedError(event.error)) {
        this.handleSecurityError(event);
      }
    });
  }

  /**
   * Handle CSP violations
   */
  private handleCSPViolation(event: SecurityPolicyViolationEvent): void {
    this.violationCount++;

    const violation = {
      blockedURI: event.blockedURI,
      columnNumber: event.columnNumber,
      disposition: event.disposition,
      documentURI: event.documentURI,
      effectiveDirective: event.effectiveDirective,
      lineNumber: event.lineNumber,
      originalPolicy: event.originalPolicy,
      referrer: event.referrer,
      sample: event.sample,
      sourceFile: event.sourceFile,
      statusCode: event.statusCode,
      violatedDirective: event.violatedDirective
    };

    logger.logSecurityEvent('csp_violation', 'BROWSER', 'HIGH', undefined, {
      violation,
      violationCount: this.violationCount,
      timestamp: new Date().toISOString()
    });

    // In development, log to console for debugging
    if (import.meta.env.NODE_ENV === 'development') {
      console.warn('CSP Violation:', violation);
    }

    // Implement violation response
    this.respondToViolation(violation);
  }

  /**
   * Check if error is security-related
   */
  private isSecurityRelatedError(error: Error): boolean {
    if (!error || !error.message) return false;

    const securityKeywords = [
    'script',
    'eval',
    'unsafe-inline',
    'unsafe-eval',
    'blocked',
    'refused',
    'security',
    'content security policy',
    'csp',
    'cors'];


    const message = error.message.toLowerCase();
    return securityKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Handle security-related errors
   */
  private handleSecurityError(event: ErrorEvent): void {
    logger.logSecurityEvent('security_error', 'APPLICATION', 'HIGH', undefined, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Respond to security violations
   */
  private respondToViolation(violation: any): void {
    // Implement automated response to violations

    // Count violations by type
    const violationType = violation.effectiveDirective || violation.violatedDirective;

    // If too many violations, consider additional measures
    if (this.violationCount > 10) {
      logger.logSecurityEvent('excessive_violations', 'SYSTEM', 'HIGH', undefined, {
        totalViolations: this.violationCount,
        violationType
      });

      // Could implement additional security measures here
      // For example: disable certain features, show security warning, etc.
    }

    // For script violations, check if it's from an allowed source
    if (violationType === 'script-src') {
      this.handleScriptViolation(violation);
    }
  }

  /**
   * Handle script source violations
   */
  private handleScriptViolation(violation: any): void {
    const blockedURI = violation.blockedURI;

    // Check if it's from a known problematic source
    const problematicSources = [
    'eval',
    'inline',
    'chrome-extension://',
    'moz-extension://',
    'data:'];


    const isProblemSource = problematicSources.some((source) =>
    blockedURI.includes(source)
    );

    if (isProblemSource) {
      logger.logSecurityEvent('problematic_script_blocked', 'CSP', 'HIGH', undefined, {
        blockedURI,
        sourceType: 'problematic',
        violation
      });
    }
  }

  /**
   * Audit existing headers in the document
   */
  private auditExistingHeaders(): void {
    const securityHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy'];


    const headerStatus: Record<string, boolean> = {};

    securityHeaders.forEach((header) => {
      const meta = document.querySelector(`meta[http-equiv="${header}"]`);
      headerStatus[header] = !!meta;

      if (!meta) {
        logger.logWarn(`Security header missing: ${header}`);
      }
    });

    logger.logInfo('Security headers audit completed', { headerStatus });
  }

  /**
   * Validate current CSP
   */
  validateCSP(): {isValid: boolean;issues: string[];recommendations: string[];} {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');

    if (!cspMeta) {
      issues.push('No Content Security Policy found');
      return { isValid: false, issues, recommendations };
    }

    const cspContent = cspMeta.getAttribute('content') || '';

    // Check for unsafe practices
    if (cspContent.includes("'unsafe-eval'")) {
      if (import.meta.env.NODE_ENV === 'production') {
        issues.push("CSP allows 'unsafe-eval' in production");
      } else {
        recommendations.push("Remove 'unsafe-eval' for production deployment");
      }
    }

    if (cspContent.includes("'unsafe-inline'")) {
      recommendations.push("Consider removing 'unsafe-inline' and using nonces or hashes");
    }

    if (!cspContent.includes('default-src')) {
      issues.push('CSP missing default-src directive');
    }

    if (!cspContent.includes('object-src')) {
      recommendations.push('Consider adding object-src directive');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get violation statistics
   */
  getViolationStats(): {
    totalViolations: number;
    violationsLastHour: number;
    topViolatedDirectives: string[];
  } {
    // This would typically connect to a more sophisticated tracking system
    return {
      totalViolations: this.violationCount,
      violationsLastHour: 0, // Would need time-based tracking
      topViolatedDirectives: [] // Would need directive-based tracking
    };
  }

  /**
   * Generate security headers report
   */
  generateSecurityReport(): {
    headersConfigured: string[];
    missingHeaders: string[];
    cspValidation: ReturnType<typeof this.validateCSP>;
    violationStats: ReturnType<typeof this.getViolationStats>;
    recommendations: string[];
  } {
    const expectedHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy'];


    const headersConfigured: string[] = [];
    const missingHeaders: string[] = [];
    const recommendations: string[] = [];

    expectedHeaders.forEach((header) => {
      const meta = document.querySelector(`meta[http-equiv="${header}"]`);
      if (meta) {
        headersConfigured.push(header);
      } else {
        missingHeaders.push(header);
      }
    });

    const cspValidation = this.validateCSP();
    const violationStats = this.getViolationStats();

    // Generate recommendations
    if (missingHeaders.length > 0) {
      recommendations.push(`Configure missing security headers: ${missingHeaders.join(', ')}`);
    }

    if (import.meta.env.NODE_ENV === 'production' && violationStats.totalViolations > 0) {
      recommendations.push('Investigate and resolve CSP violations in production');
    }

    return {
      headersConfigured,
      missingHeaders,
      cspValidation,
      violationStats,
      recommendations
    };
  }

  /**
   * Enable strict security mode
   */
  enableStrictMode(): void {
    // Implement stricter CSP
    const strictCSP = this.generateStrictCSP();
    this.setMetaHeader('Content-Security-Policy', strictCSP);

    // Enable additional security features
    this.setMetaHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    this.setMetaHeader('Cross-Origin-Opener-Policy', 'same-origin');
    this.setMetaHeader('Cross-Origin-Resource-Policy', 'same-origin');

    logger.logSecurityEvent('strict_security_mode_enabled', 'SYSTEM', 'INFO');
  }

  /**
   * Generate strict CSP for high-security environments
   */
  private generateStrictCSP(): string {
    const strictDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': []
    };

    const cspParts = Object.entries(strictDirectives).map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    });

    return cspParts.join('; ');
  }
}

// Create and export singleton instance
export const securityHeadersManager = new SecurityHeadersManager({
  enableCSP: SECURITY_CONFIG.headers.enableCSP,
  enableHSTS: SECURITY_CONFIG.https.hstsEnabled,
  enableFrameOptions: SECURITY_CONFIG.headers.enableFrameOptions,
  enableContentTypeOptions: SECURITY_CONFIG.headers.enableContentTypeOptions,
  enableXSSProtection: SECURITY_CONFIG.headers.enableXSSProtection,
  enableReferrerPolicy: SECURITY_CONFIG.headers.enableReferrerPolicy,
  reportViolations: true
});

export default securityHeadersManager;