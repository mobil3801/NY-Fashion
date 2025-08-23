
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  isRetrying: boolean;
  retryCount: number;
  isInitializationError: boolean;
}

export class SafeErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
      retryCount: 0,
      isInitializationError: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Detect if this is likely an initialization error
    const isInitializationError = 
      error.message?.includes('NetworkProvider') ||
      error.message?.includes('useNetwork') ||
      error.message?.includes('Context') ||
      error.stack?.includes('NetworkContext') ||
      error.stack?.includes('createConnectivity');

    return {
      hasError: true,
      error,
      errorInfo: error.stack || error.message,
      isInitializationError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeErrorBoundary] Caught error:', error, errorInfo);

    // Log additional context for network-related errors
    if (this.state.isInitializationError) {
      console.error('[SafeErrorBoundary] Network initialization error detected');
      console.error('Current navigator.onLine:', navigator?.onLine);
      console.error('User agent:', navigator?.userAgent);
    }

    this.setState({
      error,
      errorInfo: errorInfo.componentStack
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('[SafeErrorBoundary] Error in custom error handler:', handlerError);
      }
    }

    // For network initialization errors, automatically retry once after a delay
    if (this.state.isInitializationError && this.state.retryCount === 0) {
      this.resetTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, 2000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys = [], resetOnPropsChange } = this.props;
    const { resetKeys: prevResetKeys = [] } = prevProps;

    // Reset error state if resetKeys changed
    if (this.state.hasError && resetKeys.length > 0) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevResetKeys[index] !== key
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    // Reset on any prop change if specified
    if (this.state.hasError && resetOnPropsChange) {
      const propsChanged = Object.keys(this.props).some(
        key => (this.props as any)[key] !== (prevProps as any)[key]
      );

      if (propsChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
      retryCount: 0,
      isInitializationError: false
    });
  };

  private handleRetry = async () => {
    const currentRetryCount = this.state.retryCount + 1;

    if (currentRetryCount > this.maxRetries) {
      console.warn('[SafeErrorBoundary] Maximum retry attempts reached, forcing page reload');
      window.location.reload();
      return;
    }

    this.setState({ isRetrying: true, retryCount: currentRetryCount });

    try {
      // Wait before retrying to allow any initialization issues to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For initialization errors, try to reset the entire error boundary
      this.resetErrorBoundary();
    } catch (retryError) {
      console.error('[SafeErrorBoundary] Retry failed:', retryError);
      this.setState({ isRetrying: false });

      // If this was the last retry attempt, suggest page reload
      if (currentRetryCount >= this.maxRetries) {
        setTimeout(() => {
          if (confirm('The application encountered a persistent error. Would you like to reload the page?')) {
            window.location.reload();
          }
        }, 1000);
      }
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private getErrorDetails = () => {
    const { error, isInitializationError } = this.state;
    
    if (isInitializationError) {
      return {
        title: 'Initialization Error',
        message: 'The application failed to initialize properly. This might be due to network connectivity issues.',
        icon: WifiOff,
        severity: 'warning' as const
      };
    }

    if (error?.message?.toLowerCase().includes('network')) {
      return {
        title: 'Network Error',
        message: 'A network-related error occurred. Please check your internet connection.',
        icon: Wifi,
        severity: 'warning' as const
      };
    }

    return {
      title: 'Application Error',
      message: error?.message || 'An unexpected error occurred.',
      icon: AlertTriangle,
      severity: 'error' as const
    };
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { title, message, icon: Icon, severity } = this.getErrorDetails();
      const { isRetrying, retryCount } = this.state;
      const canRetry = retryCount < this.maxRetries;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={`p-3 rounded-full ${
                    severity === 'error' ? 'bg-red-100' : 'bg-yellow-100'
                  }`}>
                    <Icon className={`h-8 w-8 ${
                      severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {message}
                  </p>
                </div>

                {/* Retry count indicator */}
                {retryCount > 0 && (
                  <div className="text-xs text-gray-500">
                    Retry attempt: {retryCount} of {this.maxRetries}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  {canRetry ? (
                    <Button
                      onClick={this.handleRetry}
                      disabled={isRetrying}
                      className="flex-1"
                      variant="default"
                    >
                      {isRetrying ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Try Again ({this.maxRetries - retryCount} left)
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={this.handleRetry}
                      disabled={isRetrying}
                      className="flex-1"
                      variant="default"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Again
                    </Button>
                  )}
                  
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="flex-1"
                  >
                    Reload Page
                  </Button>
                </div>

                {/* Development error details */}
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

                {/* Connection status for network errors */}
                {this.state.isInitializationError && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-800">
                      <strong>Status:</strong> {navigator?.onLine ? 'Online' : 'Offline'}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      If the problem persists, try refreshing the page or checking your network connection.
                    </div>
                  </div>
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

export default SafeErrorBoundary;
