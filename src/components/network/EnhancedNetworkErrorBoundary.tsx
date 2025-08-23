import React, { Component, ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertTriangle, RefreshCw, Shield, Wifi, WifiOff } from 'lucide-react';
import ConnectionVerificationPanel from './ConnectionVerificationPanel';

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

                <ErrorActionButtons
                  onRetry={this.handleRetry}
                  onReload={this.handleReload}
                  isRetrying={this.state.isRetrying}
                  retriesLeft={this.maxRetries - this.retryCount}
                  error={this.state.error} />


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

// Error Action Buttons Component
interface ErrorActionButtonsProps {
  onRetry: () => void;
  onReload: () => void;
  isRetrying: boolean;
  retriesLeft: number;
  error: Error | null;
}

function ErrorActionButtons({ onRetry, onReload, isRetrying, retriesLeft, error }: ErrorActionButtonsProps) {
  const [verificationOpen, setVerificationOpen] = useState(false);

  // Check if this looks like a connection/certificate error
  const isConnectionError = error && (
  error.message.toLowerCase().includes('certificate') ||
  error.message.toLowerCase().includes('ssl') ||
  error.message.toLowerCase().includes('tls') ||
  error.message.toLowerCase().includes('connection') ||
  error.message.toLowerCase().includes('network') ||
  error.message.toLowerCase().includes('fetch'));


  return (
    <div className="flex flex-col gap-2 pt-4">
      {/* Primary action buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex-1"
          variant="default">

          {isRetrying ?
          <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Retrying...
            </> :

          <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again ({retriesLeft} left)
            </>
          }
        </Button>
        
        <Button
          onClick={onReload}
          variant="outline"
          className="flex-1">

          Reload page
        </Button>
      </div>

      {/* Connection verification button (shown for connection-related errors) */}
      {isConnectionError &&
      <div className="mt-2">
          <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
            <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center gap-2 text-blue-600 hover:text-blue-700"
            onClick={() => setVerificationOpen(true)}>

              <Shield className="h-4 w-4" />
              Check Connection Security (Recommended)
            </Button>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
              <ConnectionVerificationPanel onClose={() => setVerificationOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      }

      {/* Additional network troubleshooting options */}
      <div className="mt-2 flex flex-col sm:flex-row gap-2 text-xs">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => {
            // Clear all caches and service workers
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => registration.unregister());
              });
            }

            // Clear browser cache (where possible)
            if ('caches' in window) {
              caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name));
              });
            }

            // Force reload
            window.location.reload();
          }}>

          <WifiOff className="h-3 w-3 mr-1" />
          Clear Cache & Reload
        </Button>

        {navigator.onLine ?
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-green-600"
          disabled>

            <Wifi className="h-3 w-3 mr-1" />
            Online
          </Button> :

        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-red-600"
          disabled>

            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Button>
        }
      </div>
    </div>);

}

export default EnhancedNetworkErrorBoundary;