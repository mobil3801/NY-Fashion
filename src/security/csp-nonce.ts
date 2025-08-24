
import { useEffect, useState } from 'react';
import { getSecurityConfig } from '@/config/security';

export interface CSPNonce {
  nonce: string;
  timestamp: number;
}

class CSPNonceManager {
  private currentNonce: CSPNonce | null = null;
  private nonceLifetime = 5 * 60 * 1000; // 5 minutes

  generateNonce(): string {
    // Generate cryptographically secure nonce
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return btoa(String.fromCharCode.apply(null, Array.from(array))).
      replace(/[+/=]/g, '').
      substring(0, 16);
    }

    // Fallback for environments without crypto
    return Math.random().toString(36).substring(2, 18);
  }

  getCurrentNonce(): string {
    const now = Date.now();

    if (!this.currentNonce || now - this.currentNonce.timestamp > this.nonceLifetime) {
      this.currentNonce = {
        nonce: this.generateNonce(),
        timestamp: now
      };
    }

    return this.currentNonce.nonce;
  }

  generateCSPHeader(nonce: string): string {
    const config = getSecurityConfig();

    if (!config.csp.enabled) {
      return '';
    }

    const directives: string[] = [];

    Object.entries(config.csp.directives).forEach(([key, values]) => {
      if (values.length > 0) {
        const directiveName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        const directiveValues = values.map((value) =>
        value.includes('{nonce}') ? value.replace('{nonce}', nonce) : value
        ).join(' ');
        directives.push(`${directiveName} ${directiveValues}`);
      }
    });

    if (config.csp.reportUri) {
      directives.push(`report-uri ${config.csp.reportUri}`);
    }

    return directives.join('; ');
  }

  injectCSPHeader(nonce?: string): void {
    if (typeof document === 'undefined') return;

    const nonceValue = nonce || this.getCurrentNonce();
    const cspHeader = this.generateCSPHeader(nonceValue);

    if (!cspHeader) return;

    // Remove existing CSP meta tag
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    // Add new CSP meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = cspHeader;
    document.head.appendChild(meta);
  }

  validateScriptNonce(scriptElement: HTMLScriptElement): boolean {
    const currentNonce = this.getCurrentNonce();
    return scriptElement.nonce === currentNonce;
  }
}

export const cspNonceManager = new CSPNonceManager();

// React hook for CSP nonce management
export const useCSPNonce = () => {
  const [nonce, setNonce] = useState<string>('');

  useEffect(() => {
    const currentNonce = cspNonceManager.getCurrentNonce();
    setNonce(currentNonce);

    // Inject CSP header
    cspNonceManager.injectCSPHeader(currentNonce);

    // Refresh nonce periodically
    const interval = setInterval(() => {
      const newNonce = cspNonceManager.getCurrentNonce();
      setNonce(newNonce);
      cspNonceManager.injectCSPHeader(newNonce);
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  return nonce;
};

// Utility function to create secure script element
export const createSecureScript = (src: string, content?: string): HTMLScriptElement => {
  const script = document.createElement('script');
  const nonce = cspNonceManager.getCurrentNonce();

  script.nonce = nonce;

  if (src) {
    script.src = src;
  }

  if (content) {
    script.textContent = content;
  }

  return script;
};

// Utility to check if inline scripts are allowed
export const isInlineScriptAllowed = (): boolean => {
  const config = getSecurityConfig();
  return config.csp.directives.scriptSrc.includes("'unsafe-inline'");
};