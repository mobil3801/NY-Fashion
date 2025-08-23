
import React from 'react';
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ContentLoaderProps {
  isLoading?: boolean;
  error?: Error | string | null;
  hasError?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
  children?: React.ReactNode;
  loadingMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  className?: string;
  showRetryButton?: boolean;
  showReloadButton?: boolean;
  isNetworkError?: boolean;
}

export function ContentLoader({
  isLoading = false,
  error,
  hasError = false,
  onRetry,
  onReload,
  children,
  loadingMessage = 'Loading content...',
  errorTitle = 'Content Loading Error',
  errorMessage,
  className = '',
  showRetryButton = true,
  showReloadButton = true,
  isNetworkError = false
}: ContentLoaderProps) {
  // Determine if there's an actual error
  const actualError = hasError || !!error;
  
  // Get error details
  const getErrorMessage = (): string => {
    if (errorMessage) return errorMessage;
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (isNetworkError) return 'This might be a temporary network issue. Please check your connection and try again.';
    return 'Failed to load this section. Please try again.';
  };

  const getErrorIcon = () => {
    if (isNetworkError) return navigator?.onLine ? Wifi : WifiOff;
    return AlertTriangle;
  };

  // Loading state
  if (isLoading && !actualError) {
    return (
      <div className={`flex items-center justify-center min-h-32 ${className}`}>
        <div className="text-center space-y-3 p-4">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-600">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (actualError) {
    const ErrorIcon = getErrorIcon();
    
    return (
      <div className={`flex items-center justify-center min-h-32 ${className}`}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className={`p-2 rounded-full ${
                  isNetworkError ? 'bg-amber-100' : 'bg-red-100'
                }`}>
                  <ErrorIcon className={`h-6 w-6 ${
                    isNetworkError ? 'text-amber-600' : 'text-red-600'
                  }`} />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {errorTitle}
                </h3>
                <p className="text-sm text-gray-600">
                  {getErrorMessage()}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                {showRetryButton && onRetry && (
                  <Button
                    onClick={onRetry}
                    variant="default"
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                {showReloadButton && onReload && (
                  <Button
                    onClick={onReload}
                    variant="outline"
                    className="flex-1"
                  >
                    Reload Page
                  </Button>
                )}
              </div>

              {/* Network status for network errors */}
              {isNetworkError && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs text-blue-800">
                    <strong>Connection Status:</strong> {navigator?.onLine ? 'Online' : 'Offline'}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - render children
  return <>{children}</>;
}

export default ContentLoader;
