
import { useCallback } from 'react';
import { useErrorMonitoring } from '@/contexts/ErrorMonitoringContext';
import { centralizedErrorService, ErrorCategory, SeverityLevel } from '@/services/centralized-error-service';
import { logger } from '@/utils/production-logger';

export interface ErrorReportOptions {
  category?: ErrorCategory;
  severity?: SeverityLevel;
  componentName?: string;
  actionAttempted?: string;
  additionalData?: Record<string, any>;
  showToast?: boolean;
}

export const useErrorReporting = () => {
  const { reportError, reportNetworkError, reportPerformanceIssue } = useErrorMonitoring();

  const reportWithContext = useCallback((
    error: Error,
    options: ErrorReportOptions = {}
  ) => {
    const {
      category = ErrorCategory.APPLICATION,
      severity = SeverityLevel.MEDIUM,
      componentName,
      actionAttempted,
      additionalData,
      showToast = true
    } = options;

    return reportError(error, category, severity, {
      componentName,
      actionAttempted,
      additionalData,
      showToast
    });
  }, [reportError]);

  // Convenience methods for different types of errors
  const reportApplicationError = useCallback((error: Error, componentName?: string, additionalData?: any) => {
    return reportWithContext(error, {
      category: ErrorCategory.APPLICATION,
      severity: SeverityLevel.MEDIUM,
      componentName,
      additionalData
    });
  }, [reportWithContext]);

  const reportCriticalError = useCallback((error: Error, componentName?: string, additionalData?: any) => {
    return reportWithContext(error, {
      category: ErrorCategory.APPLICATION,
      severity: SeverityLevel.CRITICAL,
      componentName,
      additionalData
    });
  }, [reportWithContext]);

  const reportSecurityError = useCallback((error: Error, componentName?: string, additionalData?: any) => {
    return reportWithContext(error, {
      category: ErrorCategory.SECURITY,
      severity: SeverityLevel.CRITICAL,
      componentName,
      actionAttempted: 'security_operation',
      additionalData
    });
  }, [reportWithContext]);

  const reportDatabaseError = useCallback((error: Error, operation?: string, table?: string) => {
    return reportWithContext(error, {
      category: ErrorCategory.DATABASE,
      severity: SeverityLevel.HIGH,
      componentName: 'database_operation',
      actionAttempted: operation,
      additionalData: { table }
    });
  }, [reportWithContext]);

  const reportAuthError = useCallback((error: Error, action?: string) => {
    return reportWithContext(error, {
      category: ErrorCategory.AUTHENTICATION,
      severity: SeverityLevel.HIGH,
      componentName: 'authentication',
      actionAttempted: action
    });
  }, [reportWithContext]);

  const reportBusinessLogicError = useCallback((error: Error, businessOperation?: string, additionalData?: any) => {
    return reportWithContext(error, {
      category: ErrorCategory.BUSINESS_LOGIC,
      severity: SeverityLevel.MEDIUM,
      componentName: 'business_logic',
      actionAttempted: businessOperation,
      additionalData
    });
  }, [reportWithContext]);

  const reportAPIError = useCallback((error: Error, url: string, method: string, statusCode?: number) => {
    // Report as network error
    const networkErrorId = reportNetworkError(url, method, error, statusCode);
    
    // Also report as application error for API-related issues
    const appErrorId = reportWithContext(error, {
      category: ErrorCategory.APPLICATION,
      severity: statusCode && statusCode >= 500 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
      componentName: 'api_client',
      actionAttempted: `${method} ${url}`,
      additionalData: { statusCode, networkErrorId }
    });

    return { networkErrorId, appErrorId };
  }, [reportWithContext, reportNetworkError]);

  const reportPerformanceError = useCallback((metricName: string, value: number, threshold: number, additionalData?: any) => {
    const issueId = reportPerformanceIssue(metricName, value, threshold);
    
    // Also report as application error if performance is critically bad
    if (value > threshold * 3) {
      reportWithContext(new Error(`Critical performance issue: ${metricName}`), {
        category: ErrorCategory.PERFORMANCE,
        severity: SeverityLevel.HIGH,
        componentName: 'performance_monitor',
        actionAttempted: 'performance_measurement',
        additionalData: { metricName, value, threshold, issueId, ...additionalData }
      });
    }

    return issueId;
  }, [reportPerformanceIssue, reportWithContext]);

  // Wrapper for async operations with automatic error reporting
  const withErrorReporting = useCallback(<T>(
    asyncFn: () => Promise<T>,
    options: ErrorReportOptions & { 
      errorMessage?: string;
      onError?: (error: Error, errorId: string) => void;
    } = {}
  ) => {
    return async (): Promise<T> => {
      try {
        const result = await asyncFn();
        return result;
      } catch (error) {
        const errorToReport = error instanceof Error ? error : new Error(String(error));
        
        // Add custom error message if provided
        if (options.errorMessage) {
          errorToReport.message = `${options.errorMessage}: ${errorToReport.message}`;
        }

        const errorId = reportWithContext(errorToReport, options);
        
        // Call custom error handler if provided
        if (options.onError) {
          options.onError(errorToReport, errorId);
        }

        throw errorToReport;
      }
    };
  }, [reportWithContext]);

  // Method to report user actions that might be relevant for debugging
  const reportUserAction = useCallback((action: string, data?: any) => {
    logger.logUserAction(action, data);
    
    // Store user action for context in future error reports
    if (typeof window !== 'undefined') {
      const recentActions = JSON.parse(localStorage.getItem('recent_user_actions') || '[]');
      recentActions.unshift({
        action,
        data,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 actions
      localStorage.setItem('recent_user_actions', JSON.stringify(recentActions.slice(0, 10)));
    }
  }, []);

  return {
    reportError: reportWithContext,
    reportApplicationError,
    reportCriticalError,
    reportSecurityError,
    reportDatabaseError,
    reportAuthError,
    reportBusinessLogicError,
    reportAPIError,
    reportPerformanceError,
    reportUserAction,
    withErrorReporting
  };
};

export default useErrorReporting;
