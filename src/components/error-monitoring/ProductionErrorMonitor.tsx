
import React, { Component, ErrorInfo } from 'react';
import { logger } from '@/utils/production-logger';
import { auditLogger } from '@/utils/audit-logger';
import { productionHealthMonitor } from '@/utils/production-health-monitor';
import { ENHANCED_PRODUCTION_CONFIG } from '@/config/enhanced-production';

interface ErrorInfo {
  componentStack: string;
  errorBoundary: string;
}

interface ProductionErrorState {
  hasError: boolean;
  errorId: string;
  errorCount: number;
  lastErrorTime: number;
}

interface ProductionErrorMonitorProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error;errorId: string;retry: () => void;}>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxErrors?: number;
  resetTimeWindow?: number;
}

export class ProductionErrorMonitor extends Component<
  ProductionErrorMonitorProps,
  ProductionErrorState>
{
  private errorResetTimer: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(props: ProductionErrorMonitorProps) {
    super(props);

    this.state = {
      hasError: false,
      errorId: '',
      errorCount: 0,
      lastErrorTime: 0
    };

    this.setupGlobalErrorHandlers();
    this.setupPerformanceMonitoring();
  }

  componentDidMount() {
    // Start health monitoring
    productionHealthMonitor.startMonitoring();

    // Set up error recovery timer
    this.scheduleErrorReset();

    // Log component mounting
    logger.logComponentLifecycle('ProductionErrorMonitor', 'mounted');
  }

  componentWillUnmount() {
    // Cleanup
    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // Stop health monitoring
    productionHealthMonitor.stopMonitoring();

    logger.logComponentLifecycle('ProductionErrorMonitor', 'unmounted');
  }

  static getDerivedStateFromError(error: Error): Partial<ProductionErrorState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      errorId,
      errorCount: 1,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { errorId } = this.state;

    // Enhanced error logging
    this.logProductionError(error, errorInfo, errorId);

    // Audit the error
    auditLogger.logSecurityEvent('application_error', {
      errorId,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }, false);

    // Call external error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        logger.logError('Error in error handler', handlerError);
      }
    }

    // Check if we should reset the error boundary
    this.checkErrorRecovery();
  }

  private setupGlobalErrorHandlers() {
    // Global unhandled error handler
    window.addEventListener('error', (event) => {
      logger.logError('Global unhandled error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    });

    // Global unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      logger.logError('Unhandled promise rejection', event.reason, {
        type: 'unhandledRejection',
        promise: event.promise
      });

      // Prevent console error in production
      if (ENHANCED_PRODUCTION_CONFIG.errorHandling.preventUnhandledRejectionConsoleError) {
        event.preventDefault();
      }
    });

    // Network error monitoring
    window.addEventListener('offline', () => {
      logger.logWarn('Application went offline', {
        timestamp: new Date().toISOString(),
        navigator: {
          onLine: navigator.onLine,
          connection: (navigator as any).connection
        }
      });
    });

    window.addEventListener('online', () => {
      logger.logInfo('Application came online', {
        timestamp: new Date().toISOString(),
        navigator: {
          onLine: navigator.onLine,
          connection: (navigator as any).connection
        }
      });
    });
  }

  private setupPerformanceMonitoring() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Monitor long tasks
            if (entry.entryType === 'longtask') {
              logger.logWarn('Long task detected', {
                name: entry.name,
                startTime: entry.startTime,
                duration: entry.duration
              });
            }

            // Monitor layout shifts
            if (entry.entryType === 'layout-shift') {
              const layoutShiftEntry = entry as any;
              if (layoutShiftEntry.hadRecentInput) return;

              logger.logWarn('Layout shift detected', {
                value: layoutShiftEntry.value,
                sources: layoutShiftEntry.sources
              });
            }

            // Monitor largest contentful paint
            if (entry.entryType === 'largest-contentful-paint') {
              logger.logPerformance('page', 'largest_contentful_paint', entry.startTime, true, {
                size: (entry as any).size,
                element: (entry as any).element?.tagName
              });
            }
          }
        });

        this.performanceObserver.observe({
          entryTypes: ['longtask', 'layout-shift', 'largest-contentful-paint']
        });
      } catch (error) {
        logger.logWarn('Performance observer setup failed', error);
      }
    }
  }

  private logProductionError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack?.substring(0, ENHANCED_PRODUCTION_CONFIG.errorHandling.maxErrorStackTrace),
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,

      // Browser information
      browser: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },

      // Performance information
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null,

      // Connection information
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      } : null,

      // Application state
      state: {
        errorCount: this.state.errorCount,
        lastErrorTime: this.state.lastErrorTime,
        hasError: this.state.hasError
      }
    };

    logger.logError('React Error Boundary caught error', error, errorDetails, 'react_error_boundary');

    // Send to external error reporting service in production
    if (ENHANCED_PRODUCTION_CONFIG.errorHandling.sendTelemetry) {
      this.sendErrorToExternalService(errorDetails);
    }
  }

  private async sendErrorToExternalService(errorDetails: any) {
    try {
      // In a real application, send to your error reporting service
      // For now, we'll store it in localStorage for inspection
      const existingErrors = JSON.parse(localStorage.getItem('production_errors') || '[]');
      existingErrors.push(errorDetails);

      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }

      localStorage.setItem('production_errors', JSON.stringify(existingErrors));

      logger.logInfo('Error sent to external service', { errorId: errorDetails.errorId });
    } catch (error) {
      logger.logWarn('Failed to send error to external service', error);
    }
  }

  private checkErrorRecovery() {
    const { maxErrors = 5, resetTimeWindow = 60000 } = this.props;
    const now = Date.now();

    // Update error count
    this.setState((prevState) => ({
      errorCount: prevState.errorCount + 1,
      lastErrorTime: now
    }));

    // If we've hit the max errors, don't attempt recovery
    if (this.state.errorCount >= maxErrors) {
      logger.logError('Maximum error count reached', new Error('Error boundary disabled'), {
        errorCount: this.state.errorCount,
        maxErrors
      });
      return;
    }

    // Schedule automatic recovery
    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
    }

    this.errorResetTimer = setTimeout(() => {
      logger.logInfo('Attempting error boundary recovery', {
        errorCount: this.state.errorCount,
        timeSinceLastError: Date.now() - this.state.lastErrorTime
      });

      this.setState({
        hasError: false,
        errorId: '',
        errorCount: 0,
        lastErrorTime: 0
      });
    }, resetTimeWindow);
  }

  private scheduleErrorReset() {
    const { resetTimeWindow = 300000 } = this.props; // 5 minutes default

    const resetInterval = setInterval(() => {
      if (this.state.errorCount > 0 && Date.now() - this.state.lastErrorTime > resetTimeWindow) {
        this.setState({
          errorCount: 0,
          lastErrorTime: 0
        });
      }
    }, resetTimeWindow);

    // Cleanup on unmount
    return () => clearInterval(resetInterval);
  }

  private handleRetry = () => {
    logger.logInfo('Manual error recovery attempted', {
      errorId: this.state.errorId,
      errorCount: this.state.errorCount
    });

    this.setState({
      hasError: false,
      errorId: '',
      errorCount: Math.max(0, this.state.errorCount - 1)
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={new Error('Application error occurred')}
            errorId={this.state.errorId}
            retry={this.handleRetry} />);


      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="text-red-500 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
              <div className="space-y-2">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={this.state.errorCount >= (this.props.maxErrors || 5)}>

                  {this.state.errorCount >= (this.props.maxErrors || 5) ? 'Maximum retries reached' : 'Try again'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">

                  Reload page
                </button>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Error ID: {this.state.errorId}
              </div>
            </div>
          </div>
        </div>);

    }

    return this.props.children;
  }
}

export default ProductionErrorMonitor;