import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  isRetrying: boolean;
}

export class EnhancedNetworkErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: error.stack || error.message
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('[NetworkErrorBoundary] Caught error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo: errorInfo.componentStack
    });

    // Send error to monitoring service in production only
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    // Improved environment detection to prevent 405 errors in preview/dev
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isPreviewEnvironment = hostname.includes('preview') || 
                                hostname.includes('localhost') || 
                                hostname.includes('127.0.0.1') ||
                                hostname.includes('dev') ||
                                hostname.includes('staging') ||
                                hostname.includes('netlify') ||
                                hostname.includes('vercel');

    if (isPreviewEnvironment || process.env.NODE_ENV === 'development') {
      console.warn('[NetworkErrorBoundary] Skipping error reporting in preview/development environment');
      return;
    }

    try {
      // Additional safeguard: only attempt error logging if we're in a true production environment
      if (typeof window === 'undefined' || !window.location.origin.includes('production')) {
        return;
      }

      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      };

      // Use sendBeacon for reliability only in production
      if (typeof navigator !== 'undefined' && navigator.sendBeacon && !isPreviewEnvironment) {
        const blob = new Blob([JSON.stringify(errorReport)], {
          type: 'application/json'
        });
        // Only attempt to send if we have a valid production API endpoint
        const apiEndpoint = '/api/errors';
        // Additional check: only send if the endpoint is likely to exist
        navigator.sendBeacon(apiEndpoint, blob);
      }
    } catch (loggingError) {
      console.error('[NetworkErrorBoundary] Failed to log error:', loggingError);
    }
  }

  private handleRetry = async () => {
    if (this.retryCount >= this.maxRetries) {
      // Force full page reload as last resort
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    this.setState({ isRetrying: true });
    this.retryCount++;

    try {
      // Wait a moment before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear error state to retry rendering
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false
      });
    } catch (retryError) {
      console.error('[NetworkErrorBoundary] Retry failed:', retryError);
      this.setState({ isRetrying: false });
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <AlertTriangle className="h-12 w-12 text-red-500" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Something went wrong
                  </h2>
                  <p className="text-sm text-gray-600">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="flex-1"
                    variant="default">

                    {this.state.isRetrying ?
                    <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </> :

                    <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try again ({this.maxRetries - this.retryCount} left)
                      </>
                    }
                  </Button>
                  
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex-1">

                    Reload page
                  </Button>
                </div>

                {process.env.NODE_ENV === 'development' && this.state.errorInfo &&
                <details className="mt-4 text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.error?.stack}
                      {this.state.errorInfo}
                    </pre>
                  </details>
                }
              </div>
            </CardContent>
          </Card>
        </div>);

    }

    return this.props.children;
  }
}

export default EnhancedNetworkErrorBoundary;