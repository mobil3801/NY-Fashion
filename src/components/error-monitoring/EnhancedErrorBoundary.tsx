
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { errorTrackingService } from '@/services/enhanced-error-tracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showDetails?: boolean;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class EnhancedErrorBoundary extends Component<Props, State> {
  private errorId: string | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorId = Math.random().toString(36).substr(2, 9);
    
    this.setState({
      error,
      errorInfo
    });

    // Report error to tracking service
    errorTrackingService.reportError({
      errorType: 'React Error Boundary',
      errorMessage: error.message,
      errorStack: error.stack,
      componentName: this.props.componentName || 'Unknown Component',
      severityLevel: 2, // High severity for component errors
      additionalContext: {
        errorId: this.errorId,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        props: this.props.componentName ? { componentName: this.props.componentName } : {}
      }
    });

    // Log error for debugging
    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component:', this.props.componentName || 'Unknown');
    console.groupEnd();
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.errorId = null;
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-800">
                Something went wrong
              </CardTitle>
              <p className="text-red-600 mt-2">
                {this.props.componentName 
                  ? `An error occurred in the ${this.props.componentName} component`
                  : 'An unexpected error occurred in the application'
                }
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <Bug className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
                  {this.errorId && (
                    <div className="mt-2 text-sm">
                      <strong>Error ID:</strong> {this.errorId}
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {this.props.showDetails && this.state.error?.stack && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-red-700 mb-2">
                    Technical Details
                  </summary>
                  <pre className="text-xs bg-red-50 p-3 rounded border overflow-x-auto text-red-800">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-700 mb-1">Component Stack:</p>
                      <pre className="text-xs bg-red-50 p-3 rounded border overflow-x-auto text-red-800">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={this.handleRetry}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleReloadPage}
                  className="flex-1"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground mt-4">
                This error has been automatically reported to our monitoring system.
                {this.errorId && (
                  <div className="mt-1">
                    Reference ID: <code className="bg-gray-100 px-1 rounded">{this.errorId}</code>
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

export default EnhancedErrorBoundary;
