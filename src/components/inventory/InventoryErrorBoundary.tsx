
import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Bug,
  Copy,
  ExternalLink
} from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
  isOnline: boolean;
}

export class InventoryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isOnline: navigator.onLine
    };

    // Listen for online/offline events
    this.handleOnlineStatus = this.handleOnlineStatus.bind(this);
    this.handleRetry = this.handleRetry.bind(this);
    this.copyErrorToClipboard = this.copyErrorToClipboard.bind(this);
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnlineStatus);
    window.addEventListener('offline', this.handleOnlineStatus);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnlineStatus);
    window.removeEventListener('offline', this.handleOnlineStatus);
  }

  handleOnlineStatus() {
    this.setState({ isOnline: navigator.onLine });
    
    // If error was network-related and we're back online, suggest retry
    if (navigator.onLine && this.state.hasError && this.isNetworkError()) {
      // Auto-retry after 2 seconds if retry count is low
      if (this.state.retryCount < 2) {
        setTimeout(() => {
          this.handleRetry();
        }, 2000);
      }
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `inv_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      errorInfo
    });

    // Log error for debugging (only in development)
    if (import.meta.env.DEV) {
      console.group('🚨 Inventory Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Report error to monitoring service (in production)
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo);
    }
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    // Here you would send error to your monitoring service
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOnline: navigator.onLine
    };

    // Example: send to error tracking service
    // errorTrackingService.report(errorData);
    console.error('Error reported:', errorData);
  }

  private isNetworkError(): boolean {
    if (!this.state.error) return false;
    
    const message = this.state.error.message.toLowerCase();
    return message.includes('network') ||
           message.includes('fetch') ||
           message.includes('connection') ||
           message.includes('timeout') ||
           !this.state.isOnline;
  }

  private getErrorCategory(): 'network' | 'data' | 'rendering' | 'unknown' {
    if (!this.state.error) return 'unknown';
    
    const message = this.state.error.message.toLowerCase();
    const stack = this.state.error.stack?.toLowerCase() || '';
    
    if (this.isNetworkError()) {
      return 'network';
    }
    
    if (message.includes('cannot read') || 
        message.includes('undefined') || 
        message.includes('null')) {
      return 'data';
    }
    
    if (stack.includes('render') || 
        message.includes('element') || 
        message.includes('component')) {
      return 'rendering';
    }
    
    return 'unknown';
  }

  private handleRetry() {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  }

  private async copyErrorToClipboard() {
    if (!this.state.error) return;
    
    const errorText = [
      `Error ID: ${this.state.errorId}`,
      `Message: ${this.state.error.message}`,
      `Stack: ${this.state.error.stack}`,
      `Component Stack: ${this.state.errorInfo?.componentStack}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Online Status: ${this.state.isOnline}`,
      `Retry Count: ${this.state.retryCount}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(errorText);
      // Show some feedback that copy was successful
      if (window.toast) {
        window.toast({
          title: "Copied to Clipboard",
          description: "Error details have been copied for support.",
          variant: "default"
        });
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  private getSuggestedActions(): Array<{
    label: string;
    action: () => void;
    icon: React.ComponentType<any>;
    primary?: boolean;
  }> {
    const actions = [];
    const errorCategory = this.getErrorCategory();

    // Always show retry
    actions.push({
      label: this.state.retryCount > 0 ? `Retry (${this.state.retryCount})` : 'Try Again',
      action: this.handleRetry,
      icon: RefreshCw,
      primary: true
    });

    // Network-specific actions
    if (errorCategory === 'network') {
      if (!this.state.isOnline) {
        actions.push({
          label: 'Check Connection',
          action: () => window.open('https://www.google.com', '_blank'),
          icon: ExternalLink
        });
      }
    }

    // Copy error details for support
    actions.push({
      label: 'Copy Error Details',
      action: this.copyErrorToClipboard,
      icon: Copy
    });

    return actions;
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const errorCategory = this.getErrorCategory();
    const suggestedActions = this.getSuggestedActions();

    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-red-900">
                  Inventory System Error
                </CardTitle>
                <p className="text-sm text-red-700 mt-1">
                  Something went wrong with the inventory module
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Category Badge */}
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  errorCategory === 'network' ? 'destructive' :
                  errorCategory === 'data' ? 'secondary' : 'default'
                }
                className="flex items-center space-x-1"
              >
                {errorCategory === 'network' ? (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span>Network Issue</span>
                  </>
                ) : (
                  <>
                    <Bug className="h-3 w-3" />
                    <span>{errorCategory.charAt(0).toUpperCase() + errorCategory.slice(1)} Error</span>
                  </>
                )}
              </Badge>

              {/* Connection Status */}
              <Badge 
                variant={this.state.isOnline ? 'default' : 'destructive'}
                className="flex items-center space-x-1"
              >
                {this.state.isOnline ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                <span>{this.state.isOnline ? 'Online' : 'Offline'}</span>
              </Badge>
            </div>

            {/* Error Message */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">
                    {this.state.error?.message || 'An unexpected error occurred'}
                  </p>
                  
                  {/* Error-specific guidance */}
                  {errorCategory === 'network' && (
                    <p className="text-sm">
                      This appears to be a network connectivity issue. Please check your 
                      internet connection and try again.
                    </p>
                  )}
                  
                  {errorCategory === 'data' && (
                    <p className="text-sm">
                      This error is related to data processing. The system may be receiving 
                      unexpected data format.
                    </p>
                  )}
                  
                  {this.state.retryCount > 0 && (
                    <p className="text-sm text-gray-600">
                      Failed {this.state.retryCount} time{this.state.retryCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Technical Details (Development Only) */}
            {import.meta.env.DEV && this.state.error?.stack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {this.state.error.stack}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-4">
              {suggestedActions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.primary ? 'default' : 'outline'}
                  onClick={action.action}
                  className="flex items-center space-x-2"
                >
                  <action.icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </Button>
              ))}
            </div>

            {/* Error ID for Support */}
            <div className="text-xs text-gray-500 pt-2 border-t">
              Error ID: <code className="bg-gray-100 px-1 rounded">{this.state.errorId}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default InventoryErrorBoundary;
