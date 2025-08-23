
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Bug, Home } from 'lucide-react';
import { enhancedToast } from '@/utils/enhanced-toast';
import productionApi from '@/services/api';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'global';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ProductionErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to console
    console.error('Production Error Boundary caught an error:', error, errorInfo);
    
    // Log error details
    this.logError(error, errorInfo);
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo);
    
    // Show user-friendly error toast
    enhancedToast.error('Something went wrong. Our team has been notified.');
  }

  private async logError(error: Error, errorInfo: ErrorInfo) {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        level: this.props.level || 'component',
      };

      // Log to audit logs table for production monitoring
      await productionApi.createRecord(PRODUCTION_CONFIG.tables.auditLogs, {
        action: 'ERROR_BOUNDARY_TRIGGERED',
        details: JSON.stringify(errorData),
        timestamp: new Date().toISOString(),
        severity: 'ERROR',
      });
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: '',
      });
      enhancedToast.success('Retrying...');
    } else {
      enhancedToast.error('Maximum retry attempts reached. Please refresh the page.');
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private renderErrorDetails() {
    const { error, errorInfo, errorId } = this.state;
    
    if (!error) return null;

    const isProduction = process.env.NODE_ENV === 'production';
    
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isProduction 
              ? 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'
              : error.message
            }
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            Error ID: {errorId}
          </Badge>
          <Badge variant="outline">
            Level: {this.props.level || 'component'}
          </Badge>
          <Badge variant="outline">
            Retry: {this.retryCount}/{this.maxRetries}
          </Badge>
        </div>

        {!isProduction && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Development Debug Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                {error.stack}
              </pre>
              {errorInfo && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 mt-2">
                  {errorInfo.componentStack}
                </pre>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={this.handleRetry}
            disabled={this.retryCount >= this.maxRetries}
            variant="default"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry ({this.maxRetries - this.retryCount} left)
          </Button>
          
          <Button onClick={this.handleReload} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
          
          {this.props.level === 'page' && (
            <Button onClick={this.handleGoHome} variant="ghost" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          )}
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const { level = 'component' } = this.props;
      
      if (level === 'global') {
        return (
          <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Application Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                {this.renderErrorDetails()}
              </CardContent>
            </Card>
          </div>
        );
      }
      
      if (level === 'page') {
        return (
          <div className="flex items-center justify-center p-8">
            <Card className="w-full max-w-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Page Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                {this.renderErrorDetails()}
              </CardContent>
            </Card>
          </div>
        );
      }

      // Component level error
      return (
        <Card className="border-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Component Error
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {this.renderErrorDetails()}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ProductionErrorBoundary;
