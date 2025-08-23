import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Bug, Home } from 'lucide-react';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';
import { enhancedToast } from '@/utils/enhanced-toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReporting?: boolean;
  showReloadButton?: boolean;
  showHomeButton?: boolean;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}`;
    
    // Log error with enhanced context
    logger.logError('React Error Boundary caught error', error, {
      errorId,
      componentStack: errorInfo.componentStack,
      errorBoundaryLevel: this.props.level || 'component',
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        logger.logError('Error in custom error handler', handlerError);
      }
    }

    // Send error report if enabled
    if (this.props.enableReporting && PRODUCTION_CONFIG.monitoring.enableErrorTracking) {
      this.sendErrorReport(error, errorInfo, errorId);
    }

    // Show toast notification for non-critical errors
    if (this.props.level !== 'critical') {
      enhancedToast.showErrorToast('An error occurred in this component', {
        error,
        errorId,
        showRetry: this.state.retryCount < this.maxRetries,
        onRetry: () => this.handleRetry(),
        persistent: this.props.level === 'page'
      });
    }

    this.setState({ errorInfo });
  }

  private async sendErrorReport(error: Error, errorInfo: ErrorInfo, errorId: string) {
    try {
      // In a real production environment, send this to your error tracking service
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        level: this.props.level || 'component',
        retryCount: this.state.retryCount,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userId: await this.getCurrentUserId()
      };

      // For now, use the production logger
      logger.logError('Error boundary report', errorReport, { 
        category: 'error_boundary',
        severity: this.props.level === 'critical' ? 'critical' : 'error'
      });

      // In production, you would send this to services like Sentry, LogRocket, etc.
      // await sendToErrorTracking(errorReport);

    } catch (reportingError) {
      logger.logError('Failed to send error report', reportingError);
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    try {
      const userInfo = await window.ezsite.apis.getUserInfo();
      return userInfo.data?.ID?.toString() || null;
    } catch {
      return null;
    }
  }

  private handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      enhancedToast.showWarningToast(
        'Maximum retry attempts reached. Please refresh the page.',
        { persistent: true }
      );
      return;
    }

    logger.logUserAction('Error boundary retry attempt', {
      errorId: this.state.errorId,
      retryCount: this.state.retryCount + 1
    });

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  private handleReload = () => {
    logger.logUserAction('Error boundary page reload', {
      errorId: this.state.errorId
    });
    window.location.reload();
  };

  private handleGoHome = () => {
    logger.logUserAction('Error boundary navigate home', {
      errorId: this.state.errorId
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId, retryCount } = this.state;
      const canRetry = retryCount < this.maxRetries;

      // Critical error - full page takeover
      if (this.props.level === 'critical') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md p-6 text-center">
              <div className="mb-4">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Critical Error
              </h1>
              <p className="text-gray-600 mb-4">
                A critical error has occurred. The application needs to be restarted.
              </p>
              {PRODUCTION_CONFIG.development.enableDebugMode && errorId && (
                <Badge variant="outline" className="mb-4">
                  Error ID: {errorId}
                </Badge>
              )}
              <div className="space-y-2">
                <Button 
                  onClick={this.handleReload}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Restart Application
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  className="w-full"
                  variant="outline"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </div>
            </Card>
          </div>
        );
      }

      // Page-level error
      if (this.props.level === 'page') {
        return (
          <div className="min-h-[50vh] flex items-center justify-center px-4">
            <Card className="w-full max-w-lg p-6">
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This page encountered an error and couldn't load properly.
                </AlertDescription>
              </Alert>
              
              {PRODUCTION_CONFIG.development.enableDebugMode && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                  <details>
                    <summary className="cursor-pointer font-medium">
                      <Bug className="inline w-4 h-4 mr-1" />
                      Debug Information
                    </summary>
                    <div className="mt-2 space-y-2">
                      {errorId && (
                        <div>
                          <strong>Error ID:</strong> {errorId}
                        </div>
                      )}
                      {error && (
                        <div>
                          <strong>Error:</strong> {error.message}
                        </div>
                      )}
                      <div>
                        <strong>Retry Count:</strong> {retryCount}
                      </div>
                    </div>
                  </details>
                </div>
              )}

              <div className="flex gap-2">
                {canRetry && (
                  <Button 
                    onClick={this.handleRetry}
                    variant="default"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                {this.props.showReloadButton && (
                  <Button 
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </Button>
                )}

                {this.props.showHomeButton && (
                  <Button 
                    onClick={this.handleGoHome}
                    variant="outline"
                    className="flex-1"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                )}
              </div>
            </Card>
          </div>
        );
      }

      // Component-level error (inline)
      return (
        <Alert className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>This component encountered an error</span>
            {canRetry && (
              <Button 
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;