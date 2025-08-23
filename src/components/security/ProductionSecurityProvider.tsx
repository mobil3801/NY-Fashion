/**
 * Production Security Provider
 * Implements comprehensive security measures for production deployment
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SECURITY_CONFIG, initializeSecurity, performSecurityAudit } from '@/config/security';
import { httpsEnforcer } from '@/utils/https-enforcer';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/production-logger';

interface SecurityContextType {
  isSecure: boolean;
  securityIssues: string[];
  httpsEnforced: boolean;
  debugDisabled: boolean;
  auditResults: {
    passed: boolean;
    issues: string[];
    recommendations: string[];
  } | null;
  performSecurityCheck: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

interface ProductionSecurityProviderProps {
  children: ReactNode;
}

export const ProductionSecurityProvider: React.FC<ProductionSecurityProviderProps> = ({ children }) => {
  const [isSecure, setIsSecure] = useState(false);
  const [securityIssues, setSecurityIssues] = useState<string[]>([]);
  const [httpsEnforced, setHttpsEnforced] = useState(false);
  const [debugDisabled, setDebugDisabled] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  } | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    initializeSecurityMeasures();
  }, []);

  const initializeSecurityMeasures = async () => {
    try {
      logger.logSecurityEvent('security_initialization_started', 'SYSTEM', 'INFO');

      // Initialize core security
      initializeSecurity();

      // Initialize HTTPS enforcement
      httpsEnforcer.initialize();

      // Check HTTPS enforcement status
      const httpsStatus = httpsEnforcer.validateSecurityState();
      setHttpsEnforced(httpsStatus.isSecure);

      // Check debug mode status
      const debugMode = checkDebugModeDisabled();
      setDebugDisabled(debugMode);

      // Perform comprehensive security audit
      const audit = performSecurityAudit();
      setAuditResults(audit);

      // Collect all security issues
      const allIssues = [
        ...httpsStatus.issues,
        ...audit.issues,
        ...(debugMode ? [] : ['Debug mode is not properly disabled in production'])
      ];

      setSecurityIssues(allIssues);
      setIsSecure(allIssues.length === 0);

      // Log security status
      if (allIssues.length === 0) {
        logger.logSecurityEvent('security_initialization_success', 'SYSTEM', 'INFO', undefined, {
          httpsEnforced,
          debugDisabled: debugMode,
          auditPassed: audit.passed
        });
      } else {
        logger.logSecurityEvent('security_initialization_issues', 'SYSTEM', 'WARNING', undefined, {
          issues: allIssues,
          httpsEnforced,
          debugDisabled: debugMode
        });

        // Show warning in development, error in production
        if (import.meta.env.NODE_ENV === 'production') {
          toast({
            title: 'Security Issues Detected',
            description: `${allIssues.length} security issues found. Check console for details.`,
            variant: 'destructive'
          });
        }
      }

    } catch (error) {
      logger.logSecurityEvent('security_initialization_failed', 'SYSTEM', 'HIGH', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      setIsSecure(false);
      setSecurityIssues(['Security initialization failed']);

      if (import.meta.env.NODE_ENV === 'production') {
        toast({
          title: 'Security Error',
          description: 'Failed to initialize security measures',
          variant: 'destructive'
        });
      }
    }
  };

  const checkDebugModeDisabled = (): boolean => {
    if (import.meta.env.NODE_ENV !== 'production') {
      return true; // Debug mode is expected in development
    }

    // Check various debug indicators
    const debugIndicators = [
      // Environment variables
      import.meta.env.VITE_ENABLE_DEBUG === 'false',
      import.meta.env.VITE_ENABLE_CONSOLE_LOGGING === 'false',
      
      // Debug components should not exist in production builds
      !document.querySelector('[data-testid="debug-panel"]'),
      !document.querySelector('[data-debug-mode="true"]'),
      
      // Console should not have debug methods in production
      typeof console.debug === 'undefined' || console.debug === console.log
    ];

    return debugIndicators.every(indicator => indicator === true);
  };

  const performSecurityCheck = () => {
    // Re-run security initialization
    initializeSecurityMeasures();
  };

  // Disable certain functionality in production if security is compromised
  useEffect(() => {
    if (import.meta.env.NODE_ENV === 'production' && !isSecure) {
      // Implement additional security measures for compromised environments
      console.warn('Security: Running with compromised security state');
      
      // You could disable certain features here
      // For example, disable file uploads, limit API calls, etc.
    }
  }, [isSecure]);

  // Monitor for security violations
  useEffect(() => {
    const handleSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
      logger.logSecurityEvent('csp_violation', 'BROWSER', 'HIGH', undefined, {
        violatedDirective: event.violatedDirective,
        blockedURI: event.blockedURI,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber
      });

      if (import.meta.env.NODE_ENV === 'development') {
        console.warn('CSP Violation:', event);
      }
    };

    document.addEventListener('securitypolicyviolation', handleSecurityPolicyViolation);

    return () => {
      document.removeEventListener('securitypolicyviolation', handleSecurityPolicyViolation);
    };
  }, []);

  const contextValue: SecurityContextType = {
    isSecure,
    securityIssues,
    httpsEnforced,
    debugDisabled,
    auditResults,
    performSecurityCheck
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a ProductionSecurityProvider');
  }
  return context;
};

export default ProductionSecurityProvider;
