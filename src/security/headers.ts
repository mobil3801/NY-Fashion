
import { getSecurityConfig } from '@/config/security';

export interface SecurityHeaders {
  'Strict-Transport-Security'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'Referrer-Policy'?: string;
  'X-XSS-Protection'?: string;
  'Permissions-Policy'?: string;
  'Content-Security-Policy'?: string;
  'X-Permitted-Cross-Domain-Policies'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
}

class SecurityHeadersManager {
  private config = getSecurityConfig();

  generateHeaders(nonce?: string): SecurityHeaders {
    const headers: SecurityHeaders = {};

    // HSTS Header
    if (this.config.headers.hsts.enabled) {
      let hstsValue = `max-age=${this.config.headers.hsts.maxAge}`;

      if (this.config.headers.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }

      if (this.config.headers.hsts.preload) {
        hstsValue += '; preload';
      }

      headers['Strict-Transport-Security'] = hstsValue;
    }

    // X-Frame-Options
    if (this.config.headers.frameOptions) {
      headers['X-Frame-Options'] = this.config.headers.frameOptions;
    }

    // X-Content-Type-Options
    if (this.config.headers.contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Referrer Policy
    if (this.config.headers.referrerPolicy) {
      headers['Referrer-Policy'] = this.config.headers.referrerPolicy;
    }

    // XSS Protection
    if (this.config.headers.xssProtection) {
      headers['X-XSS-Protection'] = this.config.headers.xssProtection;
    }

    // Permissions Policy
    if (this.config.headers.permissionsPolicy) {
      headers['Permissions-Policy'] = this.config.headers.permissionsPolicy;
    }

    // Additional Security Headers
    headers['X-Permitted-Cross-Domain-Policies'] = 'none';
    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Resource-Policy'] = 'same-origin';

    return headers;
  }

  injectSecurityHeaders(nonce?: string): void {
    if (typeof document === 'undefined') return;

    const headers = this.generateHeaders(nonce);

    Object.entries(headers).forEach(([name, value]) => {
      if (value) {
        // Remove existing meta tag for this header
        const existing = document.querySelector(`meta[http-equiv="${name}"]`);
        if (existing) {
          existing.remove();
        }

        // Add new meta tag
        const meta = document.createElement('meta');
        meta.httpEquiv = name;
        meta.content = value;
        document.head.appendChild(meta);
      }
    });
  }

  // Middleware function for Express-like servers
  securityHeadersMiddleware() {
    return (req: any, res: any, next: any) => {
      const headers = this.generateHeaders();

      Object.entries(headers).forEach(([name, value]) => {
        if (value) {
          res.setHeader(name, value);
        }
      });

      next();
    };
  }
}

export const securityHeadersManager = new SecurityHeadersManager();

// React hook for security headers
export const useSecurityHeaders = () => {
  const injectHeaders = (nonce?: string) => {
    securityHeadersManager.injectSecurityHeaders(nonce);
  };

  return { injectHeaders };
};

// Security headers validation
export const validateSecurityHeaders = (response: Response): {valid: boolean;missing: string[];warnings: string[];} => {
  const requiredHeaders = [
  'Strict-Transport-Security',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy'];


  const missing: string[] = [];
  const warnings: string[] = [];

  requiredHeaders.forEach((header) => {
    if (!response.headers.get(header)) {
      missing.push(header);
    }
  });

  // Check for potential security issues
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp) {
    warnings.push('Missing Content-Security-Policy header');
  } else if (csp.includes("'unsafe-inline'")) {
    warnings.push('CSP allows unsafe-inline which reduces security');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
};