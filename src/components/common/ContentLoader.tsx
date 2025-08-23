import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Wifi, WifiOff, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNetwork } from '@/contexts/NetworkContext';
import { useErrorRecovery } from '@/hooks/use-error-recovery';
import { useApiRetry } from '@/hooks/use-api-retry';
import { normalizeError, getUserFriendlyMessage, type ApiError } from '@/lib/errors';
import { toast } from '@/hooks/use-toast';

interface ContentLoaderProps {
  isLoading?: boolean;
  error?: Error | string | null;
  hasError?: boolean;
  onRetry?: () => void | Promise<void>;
  onReload?: () => void;
  children?: React.ReactNode;
  loadingMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  className?: string;
  showRetryButton?: boolean;
  showReloadButton?: boolean;
  isNetworkError?: boolean;
  // Enhanced props
  autoRetry?: boolean;
  maxAutoRetries?: number;
  retryDelay?: number;
  operation?: string;
  showNetworkStatus?: boolean;
  compactMode?: boolean;
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
  isNetworkError = false,
  // Enhanced props
  autoRetry = true,
  maxAutoRetries = 3,
  retryDelay = 1000,
  operation = 'content loading',
  showNetworkStatus = true,
  compactMode = false
}: ContentLoaderProps) {
  const { online, connectionState, errorDetails, retryNow } = useNetwork();
  const { executeWithRetry } = useApiRetry();
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetryAt, setLastRetryAt] = useState<Date | null>(null);

  // Enhanced error recovery with auto-retry
  const {
    error: recoveryError,
    isRetrying: isAutoRetrying,
    retryCount,
    canRetry,
    retriesLeft,
    retry: executeRetry,
    forceRetry,
    clearError: clearRecoveryError,
    setError: setRecoveryError
  } = useErrorRecovery({
    maxRetries: maxAutoRetries,
    retryDelay,
    onError: (err, attempt) => {
      console.warn(`${operation} failed (attempt ${attempt}):`, err);
    },
    onMaxRetriesReached: (err) => {
      console.error(`${operation} failed after ${maxAutoRetries} attempts:`, err);
      toast({
        title: "Maximum Retries Reached",
        description: `Failed to load content after ${maxAutoRetries} attempts. Please check your connection.`,
        variant: "destructive"
      });
    },
    onSuccess: () => {
      toast({
        title: "Content Loaded",
        description: "Successfully loaded the content.",
        variant: "default"
      });
    }
  });

  // Determine if there's an actual error
  const actualError = hasError || !!error || !!recoveryError;
  const currentError = recoveryError || error;

  // Normalize and classify the error
  const normalizedError = currentError ? normalizeError(currentError, operation) : null;
  const isActualNetworkError = isNetworkError ||
  !online ||
  normalizedError?.code === 'NETWORK_OFFLINE' ||
  errorDetails?.type === 'network' ||
  connectionState === 'offline';

  // Get appropriate error message
  const getErrorMessage = useCallback((): string => {
    if (errorMessage) return errorMessage;
    if (normalizedError) return getUserFriendlyMessage(normalizedError);
    if (typeof currentError === 'string') return currentError;
    if (currentError instanceof Error) return currentError.message;
    if (isActualNetworkError) {
      if (connectionState === 'poor_connection') {
        return 'Slow or unstable connection detected. Content may take longer to load.';
      }
      return 'This might be a temporary network issue. Please check your connection and try again.';
    }
    return 'Failed to load this section. Please try again.';
  }, [errorMessage, normalizedError, currentError, isActualNetworkError, connectionState]);

  // Get appropriate error icon
  const getErrorIcon = useCallback(() => {
    if (isActualNetworkError) {
      switch (connectionState) {
        case 'offline':return WifiOff;
        case 'poor_connection':return Wifi;
        case 'reconnecting':return RefreshCw;
        default:return online ? Wifi : WifiOff;
      }
    }
    return AlertTriangle;
  }, [isActualNetworkError, connectionState, online]);

  // Auto-retry logic with improved error handling
  useEffect(() => {
    if (actualError && autoRetry && canRetry && onRetry && !isAutoRetrying && !isRetrying) {
      const shouldAutoRetry = normalizedError?.retryable !== false;

      if (shouldAutoRetry) {
        const delay = Math.min(retryDelay * Math.pow(2, retryCount), 10000); // Exponential backoff with max 10s

        const timeoutId = setTimeout(() => {
          if (canRetry && !isRetrying) {
            executeRetry(async () => {
              setIsRetrying(true);
              try {
                await onRetry();
                clearRecoveryError();
              } catch (retryError) {
                console.error('Auto-retry failed:', retryError);
                throw retryError;
              } finally {
                setIsRetrying(false);
                setLastRetryAt(new Date());
              }
            }).catch((err) => {
              console.error('Execute retry failed:', err);
            });
          }
        }, delay);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [
  actualError,
  autoRetry,
  canRetry,
  onRetry,
  isAutoRetrying,
  isRetrying,
  normalizedError?.retryable,
  retryDelay,
  retryCount,
  executeRetry,
  clearRecoveryError]
  );

  // Manual retry function with enhanced error handling
  const handleManualRetry = useCallback(async () => {
    if (isRetrying || isAutoRetrying) return;

    setIsRetrying(true);

    try {
      if (isActualNetworkError) {
        // Try network recovery first
        await retryNow();
      }

      if (onRetry) {
        await executeWithRetry(async () => {
          await onRetry();
        });
        clearRecoveryError();
        setLastRetryAt(new Date());

        toast({
          title: "Retry Successful",
          description: "Content loaded successfully.",
          variant: "default"
        });
      }
    } catch (retryError) {
      console.error('Manual retry failed:', retryError);
      setRecoveryError(retryError instanceof Error ? retryError : new Error(String(retryError)));

      toast({
        title: "Retry Failed",
        description: "Unable to load content. Please try again or reload the page.",
        variant: "destructive"
      });
    } finally {
      setIsRetrying(false);
    }
  }, [
  isRetrying,
  isAutoRetrying,
  isActualNetworkError,
  retryNow,
  onRetry,
  executeWithRetry,
  clearRecoveryError,
  setRecoveryError]
  );

  // Force retry (ignores retry limits)
  const handleForceRetry = useCallback(async () => {
    if (isRetrying) return;

    try {
      await forceRetry(async () => {
        if (onRetry) {
          await onRetry();
          setLastRetryAt(new Date());
        }
      });
    } catch (error) {
      console.error('Force retry failed:', error);
    }
  }, [isRetrying, forceRetry, onRetry]);

  // Loading state with mobile responsiveness
  if ((isLoading || isAutoRetrying || isRetrying) && !actualError) {
    const currentLoadingMessage = isAutoRetrying ?
    `Retrying... (${retryCount + 1}/${maxAutoRetries})` :
    isRetrying ?
    'Retrying...' :
    loadingMessage;

    if (compactMode) {
      return (
        <div className={`flex items-center justify-center min-h-16 p-4 ${className}`}>
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600">{currentLoadingMessage}</span>
          </div>
        </div>);

    }

    return (
      <div className={`flex items-center justify-center min-h-32 p-4 ${className}`}>
        <div className="text-center space-y-3 p-4">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-600">{currentLoadingMessage}</p>
          {isAutoRetrying &&
          <p className="text-xs text-gray-500">
              Auto-retry {retryCount + 1} of {maxAutoRetries}
            </p>
          }
        </div>
      </div>);

  }

  // Error state with mobile responsiveness
  if (actualError) {
    const ErrorIcon = getErrorIcon();
    const canRetryManually = showRetryButton && onRetry && !isRetrying;
    const canForceRetry = !canRetry && onRetry && !isRetrying;

    if (compactMode) {
      return (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-red-50 border border-red-200 rounded-lg space-y-2 sm:space-y-0 ${className}`}>
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <ErrorIcon className={`h-4 w-4 flex-shrink-0 ${isActualNetworkError ? 'text-amber-600' : 'text-red-600'}`} />
            <span className="text-sm text-gray-700 break-words">{getErrorMessage()}</span>
          </div>
          <div className="flex space-x-1 flex-shrink-0">
            {canRetryManually &&
            <Button
              onClick={handleManualRetry}
              variant="outline"
              size="sm"
              disabled={isRetrying}>

                {isRetrying ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Retry'}
              </Button>
            }
          </div>
        </div>);

    }

    return (
      <div className={`flex items-center justify-center min-h-32 p-4 ${className}`}>
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className={`p-2 rounded-full ${
                isActualNetworkError ? 'bg-amber-100' : 'bg-red-100'}`
                }>
                  <ErrorIcon className={`h-6 w-6 ${
                  isActualNetworkError ? 'text-amber-600' : 'text-red-600'} ${
                  connectionState === 'reconnecting' ? 'animate-spin' : ''}`} />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 break-words">
                  {errorTitle}
                </h3>
                <p className="text-sm text-gray-600 break-words">
                  {getErrorMessage()}
                </p>
                {retryCount > 0 &&
                <p className="text-xs text-gray-500">
                    {canRetry ?
                  `${retriesLeft} retries remaining` :
                  `Tried ${retryCount} times`
                  }
                  </p>
                }
              </div>

              <div className="flex flex-col space-y-2 pt-4">
                {canRetryManually &&
                <Button
                  onClick={handleManualRetry}
                  variant="default"
                  className="w-full"
                  disabled={isRetrying}>

                    {isRetrying ?
                  <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </> :

                  <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </>
                  }
                  </Button>
                }
                
                <div className="flex flex-col sm:flex-row gap-2">
                  {canForceRetry &&
                  <Button
                    onClick={handleForceRetry}
                    variant="outline"
                    className="flex-1"
                    disabled={isRetrying}>

                      Force Retry
                    </Button>
                  }
                  
                  {showReloadButton && onReload &&
                  <Button
                    onClick={onReload}
                    variant="outline"
                    className="flex-1">

                      Reload Page
                    </Button>
                  }
                </div>
              </div>

              {/* Network status and recovery info */}
              {showNetworkStatus && isActualNetworkError &&
              <div className="mt-4 p-3 bg-blue-50 rounded-lg space-y-2">
                  <div className="text-xs text-blue-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0">
                      <span><strong>Connection:</strong> {connectionState}</span>
                      <span><strong>Status:</strong> {online ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  {lastRetryAt &&
                <div className="text-xs text-blue-700">
                      Last retry: {lastRetryAt.toLocaleTimeString()}
                    </div>
                }
                  {isAutoRetrying &&
                <div className="text-xs text-blue-700 flex items-center justify-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Auto-retry in progress...
                    </div>
                }
                </div>
              }

              {/* Success indicator after recovery */}
              {lastRetryAt && !actualError &&
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-xs text-green-800 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Recovered at {lastRetryAt.toLocaleTimeString()}
                  </div>
                </div>
              }
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  // Success state - render children
  return <>{children}</>;
}

// Enhanced ContentLoader with built-in retry logic for common use cases
export function SmartContentLoader({
  loadOperation,
  dependencies = [],
  ...props



}: Omit<ContentLoaderProps, 'onRetry'> & {loadOperation: () => Promise<void>;dependencies?: any[];}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeLoad = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadOperation();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadOperation]);

  // Initial load and dependency-based reloading
  useEffect(() => {
    executeLoad().catch(console.error);
  }, dependencies);

  return (
    <ContentLoader
      {...props}
      isLoading={isLoading}
      error={error}
      onRetry={executeLoad}
      onReload={() => window.location.reload()} />);


}

export default ContentLoader;