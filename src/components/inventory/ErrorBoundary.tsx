
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Bug, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class InventoryErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call the error callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Inventory Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Send error to monitoring service (if available)
    try {






































      // Example: Sentry, LogRocket, etc.
      // errorMonitoring.captureException(error, { extra: errorInfo });
    } catch (monitoringError) {console.error('Failed to report error:', monitoringError);}}componentWillUnmount() {if (this.retryTimeoutId) {clearTimeout(this.retryTimeoutId);}}handleRetry = () => {if (this.state.retryCount >= 3) {// Too many retries, suggest page reload
      window.location.reload();return;}this.setState((prevState) => ({ hasError: false, error: null, errorInfo: null, retryCount: prevState.retryCount + 1 })); // Auto-retry after a delay if it fails again
    this.retryTimeoutId = window.setTimeout(() => {if (this.state.hasError && this.state.retryCount < 3) {this.handleRetry();}}, 2000);};handleReportBug = () => {const errorReport = { error: this.state.error?.message, stack: this.state.error?.stack, componentStack: this.state.errorInfo?.componentStack, userAgent: navigator.userAgent, timestamp: new Date().toISOString(), retryCount: this.state.retryCount
    };

    // Copy error report to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      alert('Error report copied to clipboard. Please share this with support.');
    } else {
      console.log('Error Report:', errorReport);
      alert('Error report logged to console. Please check the browser console and share with support.');
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNetworkError = this.state.error?.message?.includes('fetch') ||
      this.state.error?.message?.includes('network') ||
      this.state.error?.message?.includes('Network');

      const isPermissionError = this.state.error?.message?.includes('permission') ||
      this.state.error?.message?.includes('unauthorized');

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-800">
                {isNetworkError && 'Connection Error'}
                {isPermissionError && 'Permission Error'}
                {!isNetworkError && !isPermissionError && 'Something went wrong'}
              </CardTitle>
              <CardDescription>
                {isNetworkError && 'Unable to connect to the server. Please check your internet connection.'}
                {isPermissionError && 'You don\'t have permission to access this resource.'}
                {!isNetworkError && !isPermissionError && 'An unexpected error occurred in the inventory system.'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error Details */}
              {process.env.NODE_ENV === 'development' &&
              <Alert variant="destructive">
                  <Bug className="h-4 w-4" />
                  <AlertDescription>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">Technical Details</summary>
                      <div className="mt-2 text-sm font-mono bg-gray-100 p-2 rounded overflow-auto max-h-32">
                        <div><strong>Error:</strong> {this.state.error?.message}</div>
                        {this.state.error?.stack &&
                      <div className="mt-2">
                            <strong>Stack:</strong>
                            <pre className="whitespace-pre-wrap text-xs mt-1">
                              {this.state.error.stack}
                            </pre>
                          </div>
                      }
                      </div>
                    </details>
                  </AlertDescription>
                </Alert>
              }

              {/* Suggested Actions */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1"
                    disabled={this.state.retryCount >= 3}>

                    <RefreshCw className="w-4 h-4 mr-2" />
                    {this.state.retryCount >= 3 ? 'Too many retries' : `Retry (${this.state.retryCount}/3)`}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboard'}
                    className="flex-1">

                    <Home className="w-4 h-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex-1">

                    Reload Page
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={this.handleReportBug}
                    className="flex-1">

                    <Bug className="w-4 h-4 mr-2" />
                    Report Bug
                  </Button>
                </div>
              </div>

              {/* User-friendly suggestions */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>What you can try:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  {isNetworkError &&
                  <>
                      <li>Check your internet connection</li>
                      <li>Try refreshing the page</li>
                      <li>Contact your system administrator if the problem persists</li>
                    </>
                  }
                  {isPermissionError &&
                  <>
                      <li>Make sure you're logged in with the correct account</li>
                      <li>Contact your administrator to request access</li>
                      <li>Try logging out and back in</li>
                    </>
                  }
                  {!isNetworkError && !isPermissionError &&
                  <>
                      <li>Reload the page to reset the application state</li>
                      <li>Clear your browser cache and cookies</li>
                      <li>Try using a different browser</li>
                      <li>Contact support if the error continues</li>
                    </>
                  }
                </ul>
              </div>

              {/* Retry count info */}
              {this.state.retryCount > 0 &&
              <Alert>
                  <AlertDescription>
                    This error has occurred {this.state.retryCount} time{this.state.retryCount > 1 ? 's' : ''}. 
                    {this.state.retryCount >= 3 ?
                  ' Please reload the page or contact support.' :
                  ' The system will automatically retry if it happens again.'
                  }
                  </AlertDescription>
                </Alert>
              }
            </CardContent>
          </Card>
        </div>);

    }

    return this.props.children;
  }
}

export default InventoryErrorBoundary;