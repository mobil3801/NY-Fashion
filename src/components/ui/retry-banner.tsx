
import React from 'react';
import { AlertCircle, RefreshCw, X, Wifi, WifiOff, Clock, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiError, getUserFriendlyMessage } from '@/lib/errors';

export interface RetryBannerProps {
  error: ApiError | Error | null;
  isRetrying?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  attempt?: number;
  maxAttempts?: number;
  showProgress?: boolean;
}

export function RetryBanner({ 
  error, 
  isRetrying = false, 
  onRetry, 
  onDismiss,
  className = "",
  attempt = 1,
  maxAttempts = 3,
  showProgress = true
}: RetryBannerProps) {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const errorCode = isApiError ? error.code : 'UNKNOWN_ERROR';
  const errorType = isApiError ? error.type : 'unknown';
  const isRetryable = isApiError ? error.retryable : true;
  
  const maxAttemptsReached = attempt >= maxAttempts && !isRetryable;
  const isNetworkError = errorCode === 'NETWORK_OFFLINE' || errorType === 'network';
  const isTimeoutError = errorCode === 'TIMEOUT';
  const isServerError = errorCode === 'SERVER_ERROR';
  const isQueuedOffline = errorCode === 'QUEUED_OFFLINE';
  
  const getBannerVariant = () => {
    if (isQueuedOffline) return 'default';
    if (maxAttemptsReached) return 'destructive';
    if (isNetworkError || isTimeoutError) return 'default';
    if (isServerError && isRetryable) return 'default';
    return 'destructive';
  };

  const getBannerTitle = () => {
    if (isQueuedOffline) return 'Saved Offline';
    if (isNetworkError && isRetrying) return 'Reconnecting...';
    if (isNetworkError) return 'Connection Issue';
    if (isTimeoutError && isRetrying) return 'Retrying Request...';
    if (isTimeoutError) return 'Request Timeout';
    if (isServerError && isRetrying) return 'Retrying...';
    if (isServerError) return 'Server Issue';
    if (maxAttemptsReached) return 'Request Failed';
    if (isRetrying) return 'Retrying...';
    return 'Request Error';
  };

  const getBannerIcon = () => {
    if (isQueuedOffline) return Clock;
    if (isNetworkError) return isRetrying ? Wifi : WifiOff;
    if (isTimeoutError) return isRetrying ? RefreshCw : Clock;
    if (isServerError && isRetrying) return RefreshCw;
    return AlertCircle;
  };

  const getBannerMessage = () => {
    if (isApiError) {
      return getUserFriendlyMessage(error);
    }
    return error.message || 'An unexpected error occurred. Please try again.';
  };

  const getRetryButtonText = () => {
    if (isQueuedOffline) return 'Sync Now';
    if (maxAttemptsReached) return 'Try Again';
    if (isRetrying) return 'Retrying...';
    if (isNetworkError) return 'Retry Connection';
    if (isTimeoutError) return 'Retry Request';
    if (isServerError) return 'Retry';
    return 'Retry Now';
  };

  const shouldShowAttempts = showProgress && isRetryable && !maxAttemptsReached && !isNetworkError && !isQueuedOffline;
  const shouldShowRetryButton = (isRetryable || maxAttemptsReached) && onRetry && !isQueuedOffline;
  const shouldShowErrorType = isApiError && errorCode !== 'UNKNOWN_ERROR';

  const IconComponent = getBannerIcon();
  const variant = getBannerVariant();

  return (
    <Alert variant={variant} className={`mb-4 ${className}`} role="alert">
      <IconComponent 
        className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} 
        aria-hidden="true" 
      />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">{getBannerTitle()}</h4>
            <AlertDescription className="text-sm mb-2">
              {getBannerMessage()}
            </AlertDescription>
            
            {/* Error type badge */}
            {shouldShowErrorType && (
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {errorType} error
                </Badge>
                {isApiError && error.details?.operation && (
                  <Badge variant="outline" className="text-xs">
                    {error.details.operation}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Attempt counter */}
            {shouldShowAttempts && (
              <div className="text-xs text-muted-foreground">
                Attempt {Math.min(attempt, maxAttempts)} of {maxAttempts}
              </div>
            )}
            
            {/* Special messages */}
            {isQueuedOffline && (
              <div className="text-xs text-muted-foreground">
                Will sync automatically when connection returns
              </div>
            )}
            
            {isNetworkError && !isRetrying && (
              <div className="text-xs text-muted-foreground">
                Changes are saved locally and will sync when online
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {/* Retry button */}
            {shouldShowRetryButton && (
              <Button
                size="sm"
                variant={maxAttemptsReached ? "default" : "outline"}
                onClick={onRetry}
                disabled={isRetrying}
                className="text-xs"
                aria-label={isRetrying ? 'Retrying request' : 'Retry request'}>
                {isRetrying && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                {getRetryButtonText()}
              </Button>
            )}
            
            {/* Dismiss button */}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-6 w-6 p-0"
                aria-label="Dismiss error message">
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

  const setRetrying = React.useCallback((isRetrying: boolean) => {
    setBannerState(prev => ({
      ...prev,
      isRetrying
    }));
  }, []);

  return {
    ...bannerState,
    showError,
    showRetrying,
    hideError,
    dismissError,
    updateAttempt,
    setRetrying
  };
}
