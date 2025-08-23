/**
 * HTTPS Enforcement Utility
 * Handles HTTPS redirects and secure transport settings
 */

import { SECURITY_CONFIG } from '@/config/security';

export interface HttpsEnforcerConfig {
  enforceHttps: boolean;
  redirectToHttps: boolean;
  secureCookies: boolean;
  hstsMaxAge: number;
}

class HttpsEnforcer {
  private config: HttpsEnforcerConfig;

  constructor(config: HttpsEnforcerConfig) {
    this.config = config;
  }

  /**
   * Initialize HTTPS enforcement
   */
  initialize(): void {
    if (this.config.enforceHttps && this.shouldEnforceHttps()) {
      this.enforceHttps();
    }

    this.configureSecureCookies();
    this.setSecurityHeaders();
  }

  /**
   * Check if HTTPS should be enforced
   */
  private shouldEnforceHttps(): boolean {
    // Don't enforce in development or for localhost
    if (import.meta.env.NODE_ENV === 'development') {
      return false;
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return false;
    }

    return true;
  }

  /**
   * Enforce HTTPS by redirecting if needed
   */
  private enforceHttps(): void {
    if (window.location.protocol !== 'https:' && this.config.redirectToHttps) {
      const httpsUrl = window.location.href.replace('http:', 'https:');
      
      // Log the redirect for audit purposes
      console.warn(`Security: Redirecting to HTTPS: ${httpsUrl}`);
      
      // Perform the redirect
      window.location.replace(httpsUrl);
      return;
    }

    // If already HTTPS, log success
    if (window.location.protocol === 'https:') {
      console.log('Security: HTTPS enforcement verified');
    }
  }

  /**
   * Configure secure cookie settings
   */
  private configureSecureCookies(): void {
    if (!this.config.secureCookies || !this.shouldEnforceHttps()) {
      return;
    }

    // Override document.cookie to ensure secure flag
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    
    if (originalCookieDescriptor) {
      Object.defineProperty(document, 'cookie', {
        get: originalCookieDescriptor.get,
        set: function(cookieString: string) {
          // Add secure flag if not present and we're on HTTPS
          if (window.location.protocol === 'https:' && !cookieString.includes('Secure')) {
            cookieString += '; Secure';
          }
          
          // Add SameSite=Strict if not present
          if (!cookieString.includes('SameSite')) {
            cookieString += '; SameSite=Strict';
          }

          originalCookieDescriptor.set?.call(this, cookieString);
        },
        enumerable: originalCookieDescriptor.enumerable,
        configurable: originalCookieDescriptor.configurable
      });
    }
  }

  /**
   * Set security headers (client-side equivalent)
   * Note: This is mainly for documentation/testing as real headers are set server-side
   */
  private setSecurityHeaders(): void {
    // Add meta tags for security headers (fallback)
    this.addMetaTag('X-Content-Type-Options', 'nosniff');
    this.addMetaTag('X-Frame-Options', SECURITY_CONFIG.headers.frameOptions);
    this.addMetaTag('X-XSS-Protection', '1; mode=block');
    this.addMetaTag('Referrer-Policy', SECURITY_CONFIG.headers.referrerPolicy);

    // Add CSP meta tag
    if (SECURITY_CONFIG.headers.enableCSP) {
      this.addCSPMetaTag();
    }

    // Add HSTS header hint (for documentation)
    if (window.location.protocol === 'https:' && SECURITY_CONFIG.https.hstsEnabled) {
      console.log(`Security: HSTS should be configured with max-age=${SECURITY_CONFIG.https.hstsMaxAge}`);
    }
  }

  /**
   * Add security meta tag
   */
  private addMetaTag(httpEquiv: string, content: string): void {
    const existingMeta = document.querySelector(`meta[http-equiv="${httpEquiv}"]`);
    if (!existingMeta) {
      const meta = document.createElement('meta');
      meta.httpEquiv = httpEquiv;
      meta.content = content;
      document.head.appendChild(meta);
    }
  }

  /**
   * Add Content Security Policy meta tag
   */
  private addCSPMetaTag(): void {
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = this.generateCSPContent();
      document.head.appendChild(meta);
    }
  }

  /**
   * Generate CSP content
   */
  private generateCSPContent(): string {
    const directives = SECURITY_CONFIG.headers.cspDirectives;
    const cspParts = Object.entries(directives).map(([directive, sources]) => {
      return `${directive} ${sources.join(' ')}`;
    });
    return cspParts.join('; ');
  }

  /**
   * Check if the current connection is secure
   */
  isSecureContext(): boolean {
    return window.isSecureContext || false;
  }

  /**
   * Validate the current security state
   */
  validateSecurityState(): { isSecure: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.config.enforceHttps && this.shouldEnforceHttps()) {
      if (window.location.protocol !== 'https:') {
        issues.push('Connection is not using HTTPS');
      }
    }

    if (this.config.secureCookies && !this.isSecureContext()) {
      issues.push('Secure cookies required but context is not secure');
    }

    return {
      isSecure: issues.length === 0,
      issues
    };
  }
}

// Create and export singleton instance
export const httpsEnforcer = new HttpsEnforcer({
  enforceHttps: SECURITY_CONFIG.https.enforceHttps,
  redirectToHttps: true,
  secureCookies: SECURITY_CONFIG.authentication.requireSecureCookies,
  hstsMaxAge: SECURITY_CONFIG.https.hstsMaxAge
});

export default httpsEnforcer;
