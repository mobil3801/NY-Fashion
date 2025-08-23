
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { errorTrackingService, ErrorTracking, ErrorStatistics } from '@/services/enhanced-error-tracking';
import { useToast } from '@/hooks/use-toast';

interface ErrorMonitoringContextType {
  isInitialized: boolean;
  recentErrors: ErrorTracking[];
  errorCount: number;
  criticalErrorCount: number;
  isLoading: boolean;
  refreshErrors: () => Promise<void>;
  markErrorResolved: (errorId: number, notes: string) => Promise<void>;
  reportError: (error: Partial<any>) => void;
}

const ErrorMonitoringContext = createContext<ErrorMonitoringContextType | undefined>(undefined);

interface ErrorMonitoringProviderProps {
  children: ReactNode;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const ErrorMonitoringProvider: React.FC<ErrorMonitoringProviderProps> = ({
  children,
  autoRefresh = true,
  refreshInterval = 60000 // 1 minute
}) => {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [recentErrors, setRecentErrors] = useState<ErrorTracking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const initializeErrorTracking = async () => {
    try {
      await errorTrackingService.initialize();
      setIsInitialized(true);
      await refreshErrors();
    } catch (error) {
      console.error('Failed to initialize error tracking:', error);
      toast({
        title: 'Error Tracking Initialization Failed',
        description: 'Some monitoring features may not work properly',
        variant: 'destructive'
      });
    }
  };

  const refreshErrors = async () => {
    try {
      setIsLoading(true);
      const errors = await errorTrackingService.getRecentErrors(50);
      setRecentErrors(errors);
    } catch (error) {
      console.error('Failed to refresh errors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markErrorResolved = async (errorId: number, notes: string) => {
    try {
      await errorTrackingService.markErrorResolved(errorId, notes);
      await refreshErrors(); // Refresh to show updated status
      toast({
        title: 'Error Resolved',
        description: 'Error has been marked as resolved successfully'
      });
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark error as resolved',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const reportError = (error: Partial<any>) => {
    errorTrackingService.reportError(error);
  };

  useEffect(() => {
    initializeErrorTracking();
  }, []);

  useEffect(() => {
    if (isInitialized && autoRefresh) {
      const interval = setInterval(refreshErrors, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [isInitialized, autoRefresh, refreshInterval]);

  // Global error handlers
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      reportError({
        errorType: 'JavaScript Error',
        errorMessage: event.message,
        errorStack: event.error?.stack,
        url: event.filename || window.location.href,
        severityLevel: 2,
        additionalContext: {
          line: event.lineno,
          column: event.colno,
          timestamp: new Date().toISOString()
        }
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError({
        errorType: 'Unhandled Promise Rejection',
        errorMessage: event.reason?.message || String(event.reason),
        errorStack: event.reason?.stack,
        severityLevel: 2,
        additionalContext: {
          reason: event.reason,
          timestamp: new Date().toISOString()
        }
      });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const errorCount = recentErrors.length;
  const criticalErrorCount = recentErrors.filter((e) => e.severity_level <= 2 && !e.is_resolved).length;

  const contextValue: ErrorMonitoringContextType = {
    isInitialized,
    recentErrors,
    errorCount,
    criticalErrorCount,
    isLoading,
    refreshErrors,
    markErrorResolved,
    reportError
  };

  return (
    <ErrorMonitoringContext.Provider value={contextValue}>
      {children}
    </ErrorMonitoringContext.Provider>);

};

export const useErrorMonitoring = () => {
  const context = useContext(ErrorMonitoringContext);
  if (context === undefined) {
    throw new Error('useErrorMonitoring must be used within an ErrorMonitoringProvider');
  }
  return context;
};

export default ErrorMonitoringContext;