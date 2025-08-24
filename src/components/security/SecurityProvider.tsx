
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSecurityIntegration } from '@/hooks/use-security-integration';
import { securityAuditLogger } from '@/security/audit-logging';
import { rateLimitManager } from '@/security/rate-limiting';

interface SecurityContextType {
  nonce: string;
  checkRateLimit: (endpoint: string, clientId?: string) => any;
  validateInput: (data: any, schema: any) => any;
  secureApiCall: (url: string, options?: any) => Promise<Response>;
  monitorInput: (value: string, fieldName: string) => boolean;
  logSecurityEvent: (eventType: string, details: any) => void;
  onLogin: (email: string, success: boolean, error?: string) => void;
  onResourceAccess: (resource: string, action: string, success: boolean) => void;
  sanitizeString: (input: string, options?: any) => string;
  isSecureInput: (input: string) => boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const securityIntegration = useSecurityIntegration();

  useEffect(() => {
    // Initialize security monitoring
    console.log('Security Provider initialized');
    
    // Log system startup
    securityAuditLogger.log({
      eventType: 'system_event',
      severity: 'info',
      action: 'Security provider initialized',
      success: true,
      details: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        location: window.location.href
      }
    });

    // Global error handler for security events
    const handleGlobalError = (event: ErrorEvent) => {
      securityAuditLogger.log({
        eventType: 'system_event',
        severity: 'error',
        action: 'Global error detected',
        success: false,
        errorMessage: event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      securityAuditLogger.log({
        eventType: 'system_event',
        severity: 'error',
        action: 'Unhandled promise rejection',
        success: false,
        errorMessage: event.reason?.toString() || 'Unknown promise rejection',
        details: {
          reason: event.reason
        }
      });
    };

    // Monitor for suspicious DOM manipulation
    const handleDOMChanges = (mutations: MutationRecord[]) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check for potentially malicious script tags
              if (element.tagName?.toLowerCase() === 'script') {
                const scriptElement = element as HTMLScriptElement;
                if (!scriptElement.nonce || scriptElement.nonce !== securityIntegration.nonce) {
                  securityAuditLogger.logSecurityViolation(
                    'dom_manipulation',
                    'unauthorized_script_injection',
                    {
                      src: scriptElement.src,
                      content: scriptElement.textContent?.substring(0, 200),
                      hasNonce: !!scriptElement.nonce,
                      expectedNonce: securityIntegration.nonce
                    }
                  );
                }
              }
            }
          });
        }
      });
    };

    // Set up DOM monitoring
    const observer = new MutationObserver(handleDOMChanges);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Add global event listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      observer.disconnect();
      
      securityAuditLogger.log({
        eventType: 'system_event',
        severity: 'info',
        action: 'Security provider cleanup',
        success: true,
        details: {
          timestamp: new Date().toISOString()
        }
      });
    };
  }, [securityIntegration.nonce]);

  const value: SecurityContextType = {
    ...securityIntegration
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export default SecurityProvider;
