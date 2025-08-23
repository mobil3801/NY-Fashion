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

    // Send error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // In a real app, you would send this to your error monitoring service
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(errorReport)], { 
          type: 'application/json' 
        });
        navigator.sendBeacon('/api/errors', blob);
      }
    } catch (loggingError) {
      console.error('[NetworkErrorBoundary] Failed to log error:', loggingError);
    }
  }

  private handleRetry = async () => {
    if (this.retryCount >= this.maxRetries) {
      // Force full page reload as last resort
      window.location.reload();
      return;
    }

    this.setState({ isRetrying: true });
    this.retryCount++;

    try {
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));

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
    window.location.reload();
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
                    variant="default"
                  >
                    {this.state.isRetrying ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try again ({this.maxRetries - this.retryCount} left)
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex-1"
                  >
                    Reload page
                  </Button>
                </div>

                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-4 text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.error?.stack}
                      {this.state.errorInfo}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnhancedNetworkErrorBoundary;
