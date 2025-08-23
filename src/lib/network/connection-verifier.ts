
/**
 * Connection Verification Utility
 * Handles HTTPS certificate verification and connection security issues
 */

interface ConnectionVerificationResult {
  isSecure: boolean;
  hasValidCertificate: boolean;
  connectionType: 'http' | 'https' | 'mixed';
  errors: string[];
  recommendations: string[];
}

interface SecurityCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

class ConnectionVerifier {
  private static instance: ConnectionVerifier;
  private verificationCache = new Map<string, ConnectionVerificationResult>();
  private securityObserver: PerformanceObserver | null = null;

  static getInstance(): ConnectionVerifier {
    if (!ConnectionVerifier.instance) {
      ConnectionVerifier.instance = new ConnectionVerifier();
    }
    return ConnectionVerifier.instance;
  }

  /**
   * Verify the current page's connection security
   */
  async verifyCurrentConnection(): Promise<ConnectionVerificationResult> {
    const url = window.location.href;
    const cached = this.verificationCache.get(url);

    if (cached) {
      return cached;
    }

    const result = await this.performSecurityChecks();
    this.verificationCache.set(url, result);

    return result;
  }

  /**
   * Perform comprehensive security checks
   */
  private async performSecurityChecks(): Promise<ConnectionVerificationResult> {
    const checks: SecurityCheck[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // 1. Check HTTPS usage
    const httpsCheck = this.checkHTTPS();
    checks.push(httpsCheck);
    if (!httpsCheck.passed) {
      errors.push(httpsCheck.message);
      recommendations.push('Switch to HTTPS to ensure secure connections');
    }

    // 2. Check mixed content
    const mixedContentCheck = this.checkMixedContent();
    checks.push(mixedContentCheck);
    if (!mixedContentCheck.passed) {
      errors.push(mixedContentCheck.message);
      recommendations.push('Update all resources to use HTTPS URLs');
    }

    // 3. Check certificate validity (if HTTPS)
    if (window.location.protocol === 'https:') {
      const certCheck = await this.checkCertificateValidity();
      checks.push(certCheck);
      if (!certCheck.passed) {
        errors.push(certCheck.message);
        recommendations.push('Contact your hosting provider to renew SSL certificate');
      }
    }

    // 4. Check for security headers
    const headersCheck = await this.checkSecurityHeaders();
    checks.push(headersCheck);
    if (!headersCheck.passed && headersCheck.severity === 'warning') {
      recommendations.push('Configure security headers for enhanced protection');
    }

    // 5. Check for CSP violations
    const cspCheck = this.checkCSPViolations();
    checks.push(cspCheck);
    if (!cspCheck.passed) {
      errors.push(cspCheck.message);
      recommendations.push('Update Content Security Policy to fix violations');
    }

    const isSecure = window.location.protocol === 'https:';
    const hasValidCertificate = checks.find((c) => c.name === 'certificate')?.passed ?? true;
    const hasMixedContent = !checks.find((c) => c.name === 'mixedContent')?.passed;

    let connectionType: 'http' | 'https' | 'mixed' = 'http';
    if (isSecure && !hasMixedContent) {
      connectionType = 'https';
    } else if (isSecure && hasMixedContent) {
      connectionType = 'mixed';
    }

    return {
      isSecure,
      hasValidCertificate,
      connectionType,
      errors,
      recommendations
    };
  }

  /**
   * Check if the connection uses HTTPS
   */
  private checkHTTPS(): SecurityCheck {
    const isHTTPS = window.location.protocol === 'https:';
    return {
      name: 'https',
      passed: isHTTPS,
      message: isHTTPS ?
      'Connection is using HTTPS' :
      'Connection is using insecure HTTP protocol',
      severity: isHTTPS ? 'info' : 'error'
    };
  }

  /**
   * Check for mixed content (HTTP resources on HTTPS pages)
   */
  private checkMixedContent(): SecurityCheck {
    if (window.location.protocol !== 'https:') {
      return {
        name: 'mixedContent',
        passed: true,
        message: 'Mixed content check not applicable for HTTP sites',
        severity: 'info'
      };
    }

    const httpResources: string[] = [];

    // Check scripts
    document.querySelectorAll('script[src]').forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      if (src.startsWith('http://')) {
        httpResources.push(`Script: ${src}`);
      }
    });

    // Check stylesheets
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (href.startsWith('http://')) {
        httpResources.push(`Stylesheet: ${href}`);
      }
    });

    // Check images
    document.querySelectorAll('img[src]').forEach((img) => {
      const src = (img as HTMLImageElement).src;
      if (src.startsWith('http://')) {
        httpResources.push(`Image: ${src}`);
      }
    });

    const hasMixedContent = httpResources.length > 0;

    return {
      name: 'mixedContent',
      passed: !hasMixedContent,
      message: hasMixedContent ?
      `Mixed content detected: ${httpResources.length} HTTP resources on HTTPS page` :
      'No mixed content detected',
      severity: hasMixedContent ? 'error' : 'info'
    };
  }

  /**
   * Check certificate validity using fetch API
   */
  private async checkCertificateValidity(): Promise<SecurityCheck> {
    try {
      // Try to fetch a small resource to test certificate
      const response = await fetch(window.location.origin + '/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      // If fetch succeeds, certificate is likely valid
      return {
        name: 'certificate',
        passed: true,
        message: 'SSL certificate appears to be valid',
        severity: 'info'
      };
    } catch (error) {
      // If fetch fails, might be certificate issue
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isCertError = errorMessage.includes('certificate') ||
      errorMessage.includes('SSL') ||
      errorMessage.includes('TLS') ||
      errorMessage.includes('security');

      return {
        name: 'certificate',
        passed: false,
        message: isCertError ?
        'SSL certificate validation failed' :
        'Connection test failed (may be certificate-related)',
        severity: 'error'
      };
    }
  }

  /**
   * Check for important security headers
   */
  private async checkSecurityHeaders(): Promise<SecurityCheck> {
    try {
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-cache'
      });

      const headers = response.headers;
      const missingHeaders: string[] = [];

      // Check for important security headers
      if (!headers.get('strict-transport-security')) {
        missingHeaders.push('Strict-Transport-Security');
      }
      if (!headers.get('x-content-type-options')) {
        missingHeaders.push('X-Content-Type-Options');
      }
      if (!headers.get('x-frame-options') && !headers.get('content-security-policy')) {
        missingHeaders.push('X-Frame-Options or CSP frame-ancestors');
      }

      return {
        name: 'securityHeaders',
        passed: missingHeaders.length === 0,
        message: missingHeaders.length === 0 ?
        'Security headers are configured' :
        `Missing security headers: ${missingHeaders.join(', ')}`,
        severity: 'warning'
      };
    } catch (error) {
      return {
        name: 'securityHeaders',
        passed: false,
        message: 'Could not check security headers',
        severity: 'warning'
      };
    }
  }

  /**
   * Check for Content Security Policy violations
   */
  private checkCSPViolations(): SecurityCheck {
    // This would normally be checked via CSP reporting, but we can check for common issues
    const violationIndicators: string[] = [];

    // Check for inline scripts (common CSP violation)
    const inlineScripts = document.querySelectorAll('script:not([src])');
    if (inlineScripts.length > 0) {
      violationIndicators.push(`${inlineScripts.length} inline scripts detected`);
    }

    // Check for inline styles (common CSP violation)
    const inlineStyles = document.querySelectorAll('[style]');
    if (inlineStyles.length > 0) {
      violationIndicators.push(`${inlineStyles.length} inline styles detected`);
    }

    return {
      name: 'cspViolations',
      passed: violationIndicators.length === 0,
      message: violationIndicators.length === 0 ?
      'No obvious CSP violations detected' :
      `Potential CSP issues: ${violationIndicators.join(', ')}`,
      severity: violationIndicators.length > 0 ? 'warning' : 'info'
    };
  }

  /**
   * Start monitoring for security events
   */
  startSecurityMonitoring(): void {
    // Monitor for mixed content warnings
    if ('securitypolicyviolation' in window) {
      window.addEventListener('securitypolicyviolation', (event) => {
        console.warn('CSP Violation:', {
          violatedDirective: event.violatedDirective,
          blockedURI: event.blockedURI,
          lineNumber: event.lineNumber,
          sourceFile: event.sourceFile
        });
      });
    }

    // Monitor performance for security-related entries
    if ('PerformanceObserver' in window) {
      try {
        this.securityObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name.includes('security') || entry.name.includes('certificate')) {
              console.log('Security-related performance entry:', entry);
            }
          });
        });

        this.securityObserver.observe({ entryTypes: ['resource', 'navigation'] });
      } catch (error) {
        console.log('Performance monitoring not available');
      }
    }
  }

  /**
   * Stop security monitoring
   */
  stopSecurityMonitoring(): void {
    if (this.securityObserver) {
      this.securityObserver.disconnect();
      this.securityObserver = null;
    }
  }

  /**
   * Get recommendations for fixing connection issues
   */
  getFixRecommendations(result: ConnectionVerificationResult): string[] {
    const recommendations: string[] = [...result.recommendations];

    if (result.connectionType === 'http') {
      recommendations.unshift('Enable HTTPS for your domain to ensure secure connections');
    }

    if (result.connectionType === 'mixed') {
      recommendations.unshift('Fix mixed content by updating all HTTP resources to HTTPS');
    }

    if (!result.hasValidCertificate) {
      recommendations.unshift('Renew or fix SSL certificate configuration');
    }

    // Add browser-specific recommendations
    if (navigator.userAgent.includes('Chrome')) {
      recommendations.push('Check Chrome DevTools Security tab for detailed certificate information');
    } else if (navigator.userAgent.includes('Firefox')) {
      recommendations.push('Check Firefox Developer Tools Security panel for certificate details');
    }

    return recommendations;
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
  }
}

export const connectionVerifier = ConnectionVerifier.getInstance();

export type {
  ConnectionVerificationResult,
  SecurityCheck };