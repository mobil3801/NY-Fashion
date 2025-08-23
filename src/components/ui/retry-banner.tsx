
import React from 'react';
import { AlertCircle, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError, getUserFriendlyMessage } from '@/lib/errors';

export interface RetryBannerProps {
  error: ApiError | Error | null;
  isRetrying?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  attempt?: number;
  maxAttempts?: number;
}

export function RetryBanner({ 
  error, 
  isRetrying = false, 
  onRetry, 
  onDismiss,
  className = "",
  attempt = 1,
  maxAttempts = 3
}: RetryBannerProps) {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const errorCode = isApiError ? error.code : 'UNKNOWN_ERROR';
  const errorType = isApiError ? error.type : 'unknown';
  const isRetryable = isApiError ? error.retryable : true;
  
  const maxAttemptsReached = attempt >= maxAttempts && !isRetryable;
  const isNetworkError = errorCode === 'NETWORK_OFFLINE' || errorType === 'network';
  
  const getBannerVariant = () => {
    if (maxAttemptsReached) return 'destructive';
    if (isNetworkError) return 'default';
    return 'default';
  };

  const getBannerTitle = () => {
    if (isNetworkError && isRetrying) {
      return 'Reconnecting...';
    }
    if (isNetworkError) {
      return 'Connection Issue';
    }
    if (maxAttemptsReached) {
      return 'Request Failed';
    }
    if (isRetrying) {
      return 'Retrying...';
    }
    return 'Request Error';
  };

  const getBannerIcon = () => {
    if (isNetworkError) {
      return isRetrying ? Wifi : WifiOff;
    }
    return AlertCircle;
  };

  const getBannerMessage = () => {
    if (isApiError) {
      return getUserFriendlyMessage(error);
    }
    return error.message || 'An unexpected error occurred. Please try again.';
  };

  const getRetryButtonText = () => {
    if (maxAttemptsReached) {
      return 'Try Again';
    }
    if (isRetrying) {
      return 'Retrying...';
    }
    if (isNetworkError) {
      return 'Retry Connection';
    }
    return 'Retry Now';
  };

  const shouldShowAttempts = isRetryable && !maxAttemptsReached && !isNetworkError;
  const shouldShowRetryButton = (isRetryable || maxAttemptsReached) && onRetry;

  const IconComponent = getBannerIcon();

  return (
    <Alert variant={getBannerVariant()} className={`mb-4 ${className}`} role="alert">
      <IconComponent className="h-4 w-4" aria-hidden="true" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">{getBannerTitle()}</h4>
            <AlertDescription className="text-sm mb-2">
              {getBannerMessage()}
            </AlertDescription>
            
            {shouldShowAttempts && (
              <div className="text-xs text-muted-foreground">
                Attempt {Math.min(attempt, maxAttempts)} of {maxAttempts}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {shouldShowRetryButton && (
              <Button
                size="sm"
                variant={maxAttemptsReached ? "default" : "outline"}
                onClick={onRetry}
                disabled={isRetrying}
                className="text-xs"
                aria-label={isRetrying ? 'Retrying request' : 'Retry request'}
              >
                {isRetrying && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                {getRetryButtonText()}
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-6 w-6 p-0"
                aria-label="Dismiss error message"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

// Hook to manage retry banner state more effectively
export function useRetryBanner() {
  const [bannerState, setBannerState] = React.useState<{
    error: ApiError | Error | null;
    isRetrying: boolean;
    isVisible: boolean;
    attempt: number;
    maxAttempts: number;
  }>({
    error: null,
    isRetrying: false,
    isVisible: false,
    attempt: 1,
    maxAttempts: 3
  });

  const showError = React.useCallback((error: ApiError | Error, attempt = 1, maxAttempts = 3) => {
    setBannerState({
      error,
      isRetrying: false,
      isVisible: true,
      attempt,
      maxAttempts
    });
  }, []);

  const showRetrying = React.useCallback((error: ApiError | Error, attempt = 1, maxAttempts = 3) => {
    setBannerState({
      error,
      isRetrying: true,
      isVisible: true,
      attempt,
      maxAttempts
    });
  }, []);

  const hideError = React.useCallback(() => {
    setBannerState({
      error: null,
      isRetrying: false,
      isVisible: false,
      attempt: 1,
      maxAttempts: 3
    });
  }, []);

  const dismissError = React.useCallback(() => {
    setBannerState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  const updateAttempt = React.useCallback((attempt: number) => {
    setBannerState(prev => ({
      ...prev,
      attempt
    }));
  }, []);

  return {
    ...bannerState,
    showError,
    showRetrying,
    hideError,
    dismissError,
    updateAttempt
  };
}
