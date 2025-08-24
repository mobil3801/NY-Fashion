/**
 * Layout Error Handler
 * Centralized error handling for layout components with production optimizations
 */

interface LayoutError {
  type: 'render' | 'network' | 'context' | 'unknown';
  message: string;
  timestamp: number;
  component?: string;
  stack?: string;
}

class LayoutErrorHandler {
  private static instance: LayoutErrorHandler;
  private errors: LayoutError[] = [];
  private maxErrors = 10; // Prevent memory leaks

  static getInstance(): LayoutErrorHandler {
    if (!LayoutErrorHandler.instance) {
      LayoutErrorHandler.instance = new LayoutErrorHandler();
    }
    return LayoutErrorHandler.instance;
  }

  logError(error: Error, type: LayoutError['type'] = 'unknown', component?: string): void {
    const layoutError: LayoutError = {
      type,
      message: error.message,
      timestamp: Date.now(),
      component,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    // Add to error log
    this.errors.unshift(layoutError);

    // Limit stored errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[LayoutError][${type}]${component ? `[${component}]` : ''}:`, error);
    }

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(layoutError);
    }
  }

  private sendToMonitoring(error: LayoutError): void {
    // Skip error reporting in preview/development environments to prevent 405 errors
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isPreviewEnvironment = hostname.includes('preview') || hostname.includes('localhost') || hostname.includes('127.0.0.1');
    
    if (isPreviewEnvironment || process.env.NODE_ENV === 'development') {
      console.warn('[LayoutErrorHandler] Skipping error reporting in preview/development environment');
      return;
    }

    try {
      // Use sendBeacon for reliability only in production
      if (navigator.sendBeacon && typeof window !== 'undefined') {
        const errorData = JSON.stringify({
          ...error,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date(error.timestamp).toISOString()
        });

        const blob = new Blob([errorData], { type: 'application/json' });
        // Only attempt to send if we have a valid production API endpoint
        if (window.location.origin && !isPreviewEnvironment) {
          navigator.sendBeacon('/api/errors/layout', blob);
        }
      }
    } catch (monitoringError) {
      console.warn('[LayoutErrorHandler] Failed to send error to monitoring:', monitoringError);
    }
  }

  getRecentErrors(): LayoutError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  hasRecentErrors(timeWindow: number = 60000): boolean {
    const cutoff = Date.now() - timeWindow;
    return this.errors.some((error) => error.timestamp > cutoff);
  }

  getErrorsByType(type: LayoutError['type']): LayoutError[] {
    return this.errors.filter((error) => error.type === type);
  }
}

// Error boundary helper
export const createErrorBoundaryHandler = (componentName: string) => {
  const errorHandler = LayoutErrorHandler.getInstance();

  return {
    logError: (error: Error) => errorHandler.logError(error, 'render', componentName),
    getRecentErrors: () => errorHandler.getRecentErrors(),
    hasRecentErrors: () => errorHandler.hasRecentErrors()
  };
};

// Context error handler
export const logContextError = (error: Error, contextName: string): void => {
  const errorHandler = LayoutErrorHandler.getInstance();
  errorHandler.logError(error, 'context', contextName);
};

// Network error handler
export const logNetworkError = (error: Error, operation?: string): void => {
  const errorHandler = LayoutErrorHandler.getInstance();
  errorHandler.logError(error, 'network', operation);
};

export default LayoutErrorHandler;

// Global error handler setup
export const setupGlobalErrorHandling = (): void => {
  const errorHandler = LayoutErrorHandler.getInstance();

  // Only set up global error handling on client side
  if (typeof window !== 'undefined') {
    // Unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      errorHandler.logError(new Error(event.message), 'unknown', 'global');
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      errorHandler.logError(new Error(event.reason), 'unknown', 'promise');
    });
  }
};