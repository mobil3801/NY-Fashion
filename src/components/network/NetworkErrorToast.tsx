
import React from 'react';
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useNetwork } from '@/contexts/NetworkContext';
import { ApiError, ERROR_CODES, getUserFriendlyMessage } from '@/lib/errors';

interface NetworkErrorToastProps {
  error: ApiError;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
}

export function NetworkErrorToast({ error, onRetry, onDismiss }: NetworkErrorToastProps) {
  const { online, retryNow } = useNetwork();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      // First check network connection
      if (!online) {
        await retryNow();
      }
      
      // Then retry the operation if provided
      if (onRetry) {
        await onRetry();
      }
      
      // Show success toast
      toast({
        title: "Success",
        description: "Operation completed successfully",
        variant: "default"
      });
      
      onDismiss?.();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      toast({
        title: "Retry Failed",
        description: "Please try again or check your connection",
        variant: "destructive"
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorIcon = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_OFFLINE:
        return <Wifi className="h-4 w-4" />;
      case ERROR_CODES.TIMEOUT:
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_OFFLINE:
        return "Connection Lost";
      case ERROR_CODES.QUEUED_OFFLINE:
        return "Saved Offline";
      case ERROR_CODES.TIMEOUT:
        return "Request Timeout";
      case ERROR_CODES.SERVER_ERROR:
        return "Server Issue";
      default:
        return "Error";
    }
  };

  return (
    <div className="flex items-start gap-3 p-4">
      <div className="flex-shrink-0 mt-0.5 text-amber-600">
        {getErrorIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {getErrorTitle()}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {getUserFriendlyMessage(error)}
        </p>
        
        {error.retryable && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-8"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                </>
              )}
            </Button>
            
            {!online && (
              <span className="text-xs text-amber-600">
                Will retry when connection returns
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Utility function to show network error toasts
export function showNetworkErrorToast(
  error: unknown, 
  onRetry?: () => Promise<void>
): void {
  const apiError = error instanceof ApiError ? error : new ApiError(
    error instanceof Error ? error.message : 'Unknown error',
    ERROR_CODES.UNKNOWN_ERROR,
    false
  );

  const toastId = toast({
    title: undefined,
    description: undefined,
    variant: apiError.code === ERROR_CODES.QUEUED_OFFLINE ? "default" : 
             apiError.retryable ? "default" : "destructive",
    duration: apiError.code === ERROR_CODES.QUEUED_OFFLINE ? 5000 : Infinity,
    action: (
      <NetworkErrorToast
        error={apiError}
        onRetry={onRetry}
        onDismiss={() => toast.dismiss?.(toastId.id)}
      />
    ) as any
  });
}

export default NetworkErrorToast;
