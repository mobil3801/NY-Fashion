
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { logger } from '@/utils/production-logger';
import { auditLogger } from '@/utils/audit-logger';
import { ENHANCED_PRODUCTION_CONFIG } from '@/config/enhanced-production';

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByPage: Record<string, number>;
  errorsByUser: Record<string, number>;
  criticalErrors: number;
  lastError: {
    message: string;
    stack?: string;
    timestamp: string;
    page: string;
    userId?: string;
  } | null;
}

interface ErrorTrackingContextType {
  metrics: ErrorMetrics;
  trackError: (error: Error, context?: any) => void;
  trackCriticalError: (error: Error, context?: any) => void;
  trackUserError: (error: Error, userId: string, context?: any) => void;
  clearMetrics: () => void;
  getErrorReport: () => Promise<string>;
}

const ErrorTrackingContext = createContext<ErrorTrackingContextType | undefined>(undefined);

export const useErrorTracking = () => {
  const context = useContext(ErrorTrackingContext);
  if (!context) {
    throw new Error('useErrorTracking must be used within an ErrorTrackingProvider');
  }
  return context;
};

interface ErrorTrackingProviderProps {
  children: ReactNode;
  userId?: string;
}

export const ErrorTrackingProvider: React.FC<ErrorTrackingProviderProps> = ({ 
  children, 
  userId 
}) => {
  const [metrics, setMetrics] = React.useState<ErrorMetrics>({
    totalErrors: 0,
    errorsByType: {},
    errorsByPage: {},
    errorsByUser: {},
    criticalErrors: 0,
    lastError: null
  });

  const [errorBuffer, setErrorBuffer] = React.useState<any[]>([]);

  useEffect(() => {
    // Load existing metrics from storage
    loadMetricsFromStorage();
    
    // Set up global error handlers
    setupGlobalErrorHandlers();
    
    // Set up periodic error reporting
    const reportInterval = setInterval(
      flushErrorBuffer, 
      ENHANCED_PRODUCTION_CONFIG.monitoring.errorReportingInterval || 30000
    );

    return () => {
      clearInterval(reportInterval);
    };
  }, []);

  const loadMetricsFromStorage = () => {
    try {
      const storedMetrics = localStorage.getItem('error_tracking_metrics');
      if (storedMetrics) {
        const parsed = JSON.parse(storedMetrics);
        setMetrics(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      logger.logWarn('Failed to load error metrics from storage', error);
    }
  };

  const saveMetricsToStorage = (newMetrics: ErrorMetrics) => {
    try {
      localStorage.setItem('error_tracking_metrics', JSON.stringify(newMetrics));
    } catch (error) {
      logger.logWarn('Failed to save error metrics to storage', error);
    }
  };

  const setupGlobalErrorHandlers = () => {
    // JavaScript errors
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      trackError(error || new Error(String(message)), {
        source: 'global_onerror',
        filename: source,
        lineno,
        colno
      });
      
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Promise rejections
    const originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      trackError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { source: 'unhandled_rejection' }
      );
      
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection(event);
      }
    };

    // Network errors
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        
        if (!response.ok) {
          trackError(new Error(`HTTP ${response.status}: ${response.statusText}`), {
            source: 'network_error',
            url: typeof input === 'string' ? input : input.url,
            method: init?.method || 'GET',
            status: response.status
          });
        }
        
        return response;
      } catch (error) {
        trackError(error as Error, {
          source: 'network_error',
          url: typeof input === 'string' ? input : input.url,
          method: init?.method || 'GET'
        });
        throw error;
      }
    };
  };

  const trackError = React.useCallback((error: Error, context: any = {}) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
      url: window.location.href,
      userId,
      userAgent: navigator.userAgent,
      context,
      severity: 'error'
    };

    // Add to error buffer for batch processing
    setErrorBuffer(prev => [...prev, errorData].slice(-100)); // Keep last 100 errors

    // Update metrics
    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        totalErrors: prev.totalErrors + 1,
        errorsByType: {
          ...prev.errorsByType,
          [error.name]: (prev.errorsByType[error.name] || 0) + 1
        },
        errorsByPage: {
          ...prev.errorsByPage,
          [window.location.pathname]: (prev.errorsByPage[window.location.pathname] || 0) + 1
        },
        errorsByUser: userId ? {
          ...prev.errorsByUser,
          [userId]: (prev.errorsByUser[userId] || 0) + 1
        } : prev.errorsByUser,
        lastError: {
          message: error.message,
          stack: error.stack?.substring(0, 500),
          timestamp: errorData.timestamp,
          page: window.location.pathname,
          userId
        }
      };

      saveMetricsToStorage(newMetrics);
      return newMetrics;
    });

    // Log the error
    logger.logError('Tracked error', error, errorData);

    // Audit the error
    auditLogger.logUserAction('error_occurred', 'application', {
      errorType: error.name,
      errorMessage: error.message,
      page: window.location.pathname,
      context
    }, false, error.message);

  }, [userId]);

  const trackCriticalError = React.useCallback((error: Error, context: any = {}) => {
    // Mark as critical
    const criticalContext = { ...context, severity: 'critical', critical: true };
    
    trackError(error, criticalContext);

    // Update critical error count
    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        criticalErrors: prev.criticalErrors + 1
      };
      saveMetricsToStorage(newMetrics);
      return newMetrics;
    });

    // Immediate reporting for critical errors
    flushErrorBuffer();

    // Log as critical
    logger.logError('Critical error tracked', error, criticalContext, 'critical');

    // Audit as security event
    auditLogger.logSecurityEvent('critical_error', {
      errorMessage: error.message,
      page: window.location.pathname,
      context: criticalContext
    }, false);

  }, [trackError]);

  const trackUserError = React.useCallback((error: Error, trackingUserId: string, context: any = {}) => {
    const userContext = { ...context, userId: trackingUserId, source: 'user_action' };
    trackError(error, userContext);
  }, [trackError]);

  const clearMetrics = React.useCallback(() => {
    const clearedMetrics: ErrorMetrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByPage: {},
      errorsByUser: {},
      criticalErrors: 0,
      lastError: null
    };

    setMetrics(clearedMetrics);
    setErrorBuffer([]);
    saveMetricsToStorage(clearedMetrics);
    
    logger.logInfo('Error metrics cleared');
  }, []);

  const flushErrorBuffer = React.useCallback(async () => {
    if (errorBuffer.length === 0) return;

    const errors = [...errorBuffer];
    setErrorBuffer([]);

    try {
      // In a real application, send to external error tracking service
      // For now, log and store locally
      logger.logInfo('Flushing error buffer', { errorCount: errors.length });

      // Store errors for later inspection
      const existingErrors = JSON.parse(localStorage.getItem('error_tracking_buffer') || '[]');
      const allErrors = [...existingErrors, ...errors].slice(-500); // Keep last 500 errors
      localStorage.setItem('error_tracking_buffer', JSON.stringify(allErrors));

      // In production, you would send these to your error tracking service:
      // await sendErrorsToService(errors);

    } catch (error) {
      logger.logWarn('Failed to flush error buffer', error);
      // Put errors back in buffer
      setErrorBuffer(prev => [...errors, ...prev]);
    }
  }, [errorBuffer]);

  const getErrorReport = React.useCallback(async (): Promise<string> => {
    const report = `
# Error Tracking Report

**Generated**: ${new Date().toISOString()}

## Summary
- **Total Errors**: ${metrics.totalErrors}
- **Critical Errors**: ${metrics.criticalErrors}
- **Error Rate**: ${metrics.totalErrors > 0 ? (metrics.criticalErrors / metrics.totalErrors * 100).toFixed(2) : 0}%

## Last Error
${metrics.lastError ? `
- **Message**: ${metrics.lastError.message}
- **Page**: ${metrics.lastError.page}
- **Time**: ${metrics.lastError.timestamp}
- **User**: ${metrics.lastError.userId || 'Anonymous'}
` : 'No errors recorded'}

## Errors by Type
${Object.entries(metrics.errorsByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n')}

## Errors by Page
${Object.entries(metrics.errorsByPage)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([page, count]) => `- **${page}**: ${count}`)
  .join('\n')}

## Recent Errors
${errorBuffer
  .slice(-5)
  .reverse()
  .map(error => `- **${error.timestamp}**: ${error.message} (${error.page})`)
  .join('\n')}
    `.trim();

    return report;
  }, [metrics, errorBuffer]);

  const contextValue = React.useMemo(() => ({
    metrics,
    trackError,
    trackCriticalError,
    trackUserError,
    clearMetrics,
    getErrorReport
  }), [metrics, trackError, trackCriticalError, trackUserError, clearMetrics, getErrorReport]);

  return (
    <ErrorTrackingContext.Provider value={contextValue}>
      {children}
    </ErrorTrackingContext.Provider>
  );
};

export default ErrorTrackingProvider;
