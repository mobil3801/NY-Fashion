
import React from 'react';
import { AlertTriangle, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNetwork } from '@/contexts/NetworkContext';
import { showNetworkErrorToast } from './NetworkErrorToast';

interface NetworkErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface NetworkErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error?: Error;
    retry: () => void;
    online: boolean;
  }>;
}

export class NetworkErrorBoundary extends React.Component<
  NetworkErrorBoundaryProps,
  NetworkErrorBoundaryState
> {
  private networkContext?: {
    online: boolean;
    retryNow: () => Promise<void>;
  };

  constructor(props: NetworkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): NetworkErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('NetworkErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      hasError: true,
      error,
      errorInfo
    });

    // Show network error toast if it's a network-related error
    if (this.isNetworkError(error)) {
      showNetworkErrorToast(error, this.handleRetry);
    }
  }

  private isNetworkError = (error: Error): boolean => {
    const networkErrorPatterns = [
      'fetch',
      'network',
      'Failed to fetch',
      'NetworkError',
      'ERR_NETWORK',
      'ERR_INTERNET_DISCONNECTED',
      'timeout',
      'aborted'
    ];

    return networkErrorPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase()) ||
      error.name.toLowerCase().includes(pattern.toLowerCase())
    );
  };

  private handleRetry = async () => {
    if (this.networkContext) {
      try {
        await this.networkContext.retryNow();
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    
    // Clear the error state to retry rendering
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;
      
      if (Fallback && this.networkContext) {
        return (
          <Fallback
            error={this.state.error}
            retry={this.handleRetry}
            online={this.networkContext.online}
          />
        );
      }
      
      // Default fallback UI
      return <NetworkErrorFallback error={this.state.error} retry={this.handleRetry} />;
    }

    return (
      <NetworkContextConsumer networkContext={this.networkContext}>
        {(context) => {
          this.networkContext = context;
          return this.props.children;
        }}
      </NetworkContextConsumer>
    );
  }
}

// Helper component to access network context in class component
function NetworkContextConsumer({ 
  children, 
  networkContext 
}: { 
  children: (context: any) => React.ReactNode;
  networkContext?: any;
}) {
  const context = useNetwork();
  return <>{children(context)}</>;
}

// Default error fallback component
function NetworkErrorFallback({ 
  error, 
  retry 
}: { 
  error?: Error; 
  retry: () => void; 
}) {
  const { online } = useNetwork();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-2 bg-red-100 rounded-full w-fit">
            {online ? (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            ) : (
              <Wifi className="h-6 w-6 text-red-600" />
            )}
          </div>
          
          <CardTitle className="text-lg">
            {online ? 'Something went wrong' : 'Connection lost'}
          </CardTitle>
          
          <CardDescription>
            {online 
              ? 'An unexpected error occurred while loading the application.'
              : 'Please check your internet connection and try again.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium mb-2">
                Error details
              </summary>
              <pre className="whitespace-pre-wrap bg-gray-100 p-2 rounded text-xs overflow-auto">
                {error.message}
              </pre>
            </details>
          )}
          
          <div className="flex justify-center">
            <Button onClick={retry} className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
          
          {!online && (
            <p className="text-xs text-center text-gray-500">
              Your changes are saved locally and will sync when you're back online.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default NetworkErrorBoundary;
