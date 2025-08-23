import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

class GlobalErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
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
    console.error('Global Error Boundary caught error:', error, errorInfo);

    this.setState({ errorInfo });

    // Log error to console for debugging
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Error Details:', errorDetails);
  }

  private handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      console.warn('Maximum retry attempts reached');
      return;
    }

    console.log(`Retrying... Attempt ${this.state.retryCount + 1}/${this.maxRetries}`);

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  private handleReload = () => {
    console.log('Reloading page...');
    window.location.reload();
  };

  private handleGoHome = () => {
    console.log('Navigating to home...');
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

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <Card className="w-full max-w-2xl p-8">
            <div className="text-center mb-6">
              <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-4">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
            </div>

            <Alert className="mb-6">
              <Bug className="h-4 w-4" />
              <AlertDescription>
                Error ID: <code className="text-sm font-mono bg-gray-100 px-1 rounded">{errorId}</code>
                {retryCount > 0 &&
                <span className="ml-2 text-amber-600">
                    (Retry attempt: {retryCount})
                  </span>
                }
              </AlertDescription>
            </Alert>

            <div className="space-y-3 mb-6">
              {canRetry &&
              <Button
                onClick={this.handleRetry}
                className="w-full"
                variant="default">

                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              }
              
              <Button
                onClick={this.handleReload}
                className="w-full"
                variant="outline">

                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              
              <Button
                onClick={this.handleGoHome}
                className="w-full"
                variant="outline">

                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </div>

            {/* Development-only error details */}
            {(import.meta.env.DEV || import.meta.env.NODE_ENV === 'development') &&
            <details className="mt-6">
                <summary className="cursor-pointer font-medium text-sm text-gray-600 hover:text-gray-800">
                  Technical Details (Development)
                </summary>
                <div className="mt-4 p-4 bg-gray-50 rounded border text-sm">
                  {error &&
                <div className="mb-4">
                      <strong>Error:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">{error.message}</pre>
                      {error.stack &&
                  <>
                          <strong className="block mt-2">Stack Trace:</strong>
                          <pre className="mt-1 text-xs overflow-x-auto text-gray-600">
                            {error.stack}
                          </pre>
                        </>
                  }
                    </div>
                }
                  
                  {errorInfo &&
                <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto text-gray-600">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                }
                </div>
              </details>
            }
          </Card>
        </div>);

    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;