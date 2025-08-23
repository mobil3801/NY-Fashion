
import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createUserFriendlyErrorMessage, RetryableError } from '@/utils/apiRetry';

export interface RetryBannerProps {
  error: Error | null;
  isRetrying: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export interface RetryBannerState {
  isVisible: boolean;
  currentAttempt: number;
  maxAttempts: number;
  canRetry: boolean;
  errorMessage: string;
}

export function RetryBanner({ 
  error, 
  isRetrying, 
  onRetry, 
  onDismiss,
  className = ""
}: RetryBannerProps) {
  if (!error) return null;

  const isRetryableError = error instanceof RetryableError;
  const errorMessage = createUserFriendlyErrorMessage(error);
  
  const currentAttempt = isRetryableError ? error.attempt : 1;
  const maxAttempts = isRetryableError ? error.maxAttempts : 3;
  const canRetry = isRetryableError ? error.canRetry : true;
  const maxAttemptsReached = currentAttempt >= maxAttempts && !canRetry;

  const getBannerVariant = () => {
    if (maxAttemptsReached) return 'destructive';
    return 'default';
  };

  const getBannerTitle = () => {
    if (maxAttemptsReached) {
      return 'Request Failed';
    }
    if (isRetrying) {
      return 'Retrying...';
    }
    return 'Request Error';
  };

  const getRetryButtonText = () => {
    if (maxAttemptsReached) {
      return 'Try Again';
    }
    if (isRetrying) {
      return 'Retrying...';
    }
    return 'Retry Now';
  };

  return (
    <Alert variant={getBannerVariant()} className={`mb-4 ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-1">{getBannerTitle()}</h4>
            <AlertDescription className="text-sm mb-2">
              {errorMessage}
            </AlertDescription>
            
            {!maxAttemptsReached && (
              <div className="text-xs text-muted-foreground">
                Attempt {currentAttempt} of {maxAttempts}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {(canRetry || maxAttemptsReached) && onRetry && (
              <Button
                size="sm"
                variant={maxAttemptsReached ? "default" : "outline"}
                onClick={onRetry}
                disabled={isRetrying}
                className="text-xs"
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

// Hook to manage retry banner state
export function useRetryBanner() {
  const [bannerState, setBannerState] = React.useState<{
    error: Error | null;
    isRetrying: boolean;
    isVisible: boolean;
  }>({
    error: null,
    isRetrying: false,
    isVisible: false
  });

  const showError = React.useCallback((error: Error) => {
    setBannerState({
      error,
      isRetrying: false,
      isVisible: true
    });
  }, []);

  const showRetrying = React.useCallback((error: Error) => {
    setBannerState({
      error,
      isRetrying: true,
      isVisible: true
    });
  }, []);

  const hideError = React.useCallback(() => {
    setBannerState({
      error: null,
      isRetrying: false,
      isVisible: false
    });
  }, []);

  const dismissError = React.useCallback(() => {
    setBannerState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  return {
    ...bannerState,
    showError,
    showRetrying,
    hideError,
    dismissError
  };
}
