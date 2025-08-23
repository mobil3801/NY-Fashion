/**
 * Security Audit Hook
 * Provides security monitoring and audit capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { useSecurity } from '@/components/security/ProductionSecurityProvider';
import { environmentValidator } from '@/utils/env-validator';
import { securityHeadersManager } from '@/utils/security-headers';
import { secureAuthManager } from '@/utils/secure-auth-manager';
import { productionDebugDisabler } from '@/utils/production-debug-disabler';
import { logger } from '@/utils/production-logger';

export interface SecurityAuditResult {
  timestamp: string;
  overallScore: number;
  isSecure: boolean;
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  details: {
    environment: any;
    headers: any;
    authentication: any;
    debug: any;
    https: boolean;
  };
}

export const useSecurityAudit = () => {
  const { isSecure, securityIssues, httpsEnforced, debugDisabled } = useSecurity();
  const [auditResults, setAuditResults] = useState<SecurityAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState<Date | null>(null);

  const performSecurityAudit = useCallback(async () => {
    setIsLoading(true);

    try {
      logger.logSecurityEvent('security_audit_started', 'SYSTEM', 'INFO');

      // Gather all security information
      const envReport = environmentValidator.generateProductionReport();
      const headersReport = securityHeadersManager.generateSecurityReport();
      const authStats = secureAuthManager.getSecurityStats();
      const debugStatus = productionDebugDisabler.getStatus();

      // Calculate overall security score
      let score = 100;
      const criticalIssues: string[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Environment issues
      if (!envReport.isProductionReady) {
        score -= 25;
        criticalIssues.push('Environment is not production-ready');
      }
      criticalIssues.push(...envReport.criticalIssues);
      warnings.push(...envReport.warnings);
      score -= envReport.criticalIssues.length * 10;

      // Security headers issues
      score -= headersReport.missingHeaders.length * 5;
      if (headersReport.missingHeaders.length > 0) {
        warnings.push(`Missing security headers: ${headersReport.missingHeaders.join(', ')}`);
      }
      recommendations.push(...headersReport.recommendations);

      // Authentication issues
      if (authStats.lockedAccounts > 0) {
        warnings.push(`${authStats.lockedAccounts} accounts are currently locked`);
      }
      if (authStats.totalFailedAttempts > 10) {
        warnings.push(`High number of failed login attempts: ${authStats.totalFailedAttempts}`);
      }

      // Debug mode issues
      if (import.meta.env.NODE_ENV === 'production' && !debugStatus.debugDisabled) {
        score -= 20;
        criticalIssues.push('Debug mode is enabled in production');
      }

      // HTTPS issues
      if (import.meta.env.NODE_ENV === 'production' && !httpsEnforced) {
        score -= 15;
        criticalIssues.push('HTTPS is not enforced in production');
      }

      // Additional security issues
      criticalIssues.push(...securityIssues);
      score -= securityIssues.length * 8;

      // Apply bonuses
      if (httpsEnforced && import.meta.env.NODE_ENV === 'production') score += 5;
      if (debugDisabled && import.meta.env.NODE_ENV === 'production') score += 10;
      if (headersReport.headersConfigured.length >= 4) score += 5;

      // Ensure score is within bounds
      score = Math.max(0, Math.min(100, score));

      // Generate recommendations
      if (score < 80) {
        recommendations.push('Review and address all security issues to improve security posture');
      }
      if (!httpsEnforced && import.meta.env.NODE_ENV === 'production') {
        recommendations.push('Enable HTTPS enforcement for production deployment');
      }
      if (envReport.missingOptionalVars.length > 0) {
        recommendations.push('Consider configuring optional environment variables for enhanced security');
      }

      const auditResult: SecurityAuditResult = {
        timestamp: new Date().toISOString(),
        overallScore: score,
        isSecure: criticalIssues.length === 0 && score >= 70,
        criticalIssues,
        warnings,
        recommendations,
        details: {
          environment: envReport,
          headers: headersReport,
          authentication: authStats,
          debug: debugStatus,
          https: httpsEnforced
        }
      };

      setAuditResults(auditResult);
      setLastAuditTime(new Date());

      logger.logSecurityEvent('security_audit_completed', 'SYSTEM', 'INFO', undefined, {
        score,
        isSecure: auditResult.isSecure,
        criticalIssuesCount: criticalIssues.length,
        warningsCount: warnings.length
      });

      return auditResult;

    } catch (error) {
      logger.logSecurityEvent('security_audit_failed', 'SYSTEM', 'HIGH', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSecure, securityIssues, httpsEnforced, debugDisabled]);

  // Auto-audit on mount and when security state changes
  useEffect(() => {
    performSecurityAudit();
  }, [performSecurityAudit]);

  // Periodic security audit (every 5 minutes in production)
  useEffect(() => {
    if (import.meta.env.NODE_ENV === 'production') {
      const interval = setInterval(() => {
        performSecurityAudit();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [performSecurityAudit]);

  return {
    auditResults,
    isLoading,
    lastAuditTime,
    performSecurityAudit,

    // Helper methods
    getSecurityGrade: () => {
      if (!auditResults) return 'N/A';
      const score = auditResults.overallScore;
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    },

    hasCriticalIssues: () => {
      return auditResults?.criticalIssues.length > 0;
    },

    getIssueCount: () => {
      return (auditResults?.criticalIssues.length || 0) + (auditResults?.warnings.length || 0);
    },

    isProductionReady: () => {
      return auditResults?.isSecure && auditResults?.overallScore >= 80;
    }
  };
};

export default useSecurityAudit;