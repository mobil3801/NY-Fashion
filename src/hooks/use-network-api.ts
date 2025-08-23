
import { useCallback, useState } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { apiClient } from '@/lib/network/client';
import { toast } from '@/hooks/use-toast';
import { ApiError, ERROR_CODES, getUserFriendlyMessage, normalizeError } from '@/lib/errors';
import { showNetworkErrorToast } from '@/components/network/NetworkErrorToast';

interface UseNetworkApiOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  requireOnline?: boolean;
  retryOnError?: boolean;
  operation?: string;
}

interface UseNetworkApiReturn<T> {
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  loading: boolean;
  error: ApiError | null;
  retry: () => Promise<void>;
  clearError: () => void;
  isRetrying: boolean;
}

export function useNetworkApi<T = any>(
  defaultOptions: UseNetworkApiOptions = {}
): UseNetworkApiReturn<T> {
  const { online, retryNow, connectionQuality } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastOperation, setLastOperation] = useState<(() => Promise<T>) | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options: UseNetworkApiOptions = {}
  ): Promise<T | null> => {
    const finalOptions = { ...defaultOptions, ...options };

    setLoading(true);
    setError(null);
    setLastOperation(() => operation);

    try {
      // Check if operation requires online connection
      if (finalOptions.requireOnline && !online) {
        throw new ApiError(
          'This operation requires an active internet connection',
          ERROR_CODES.NETWORK_OFFLINE,
          true,
          { operation: finalOptions.operation || 'API call' }
        );
      }

      // Warn about poor connection quality for critical operations
      if (online && connectionQuality === 'poor' && finalOptions.requireOnline) {
        toast({
          title: "Poor Connection",
          description: "Connection is unstable. Operation may take longer than usual.",
          variant: "default"
        });
      }

      const result = await operation();

      // Show success toast if requested
      if (finalOptions.showSuccessToast) {
        toast({
          title: "Success",
          description: "Operation completed successfully",
          variant: "default"
        });
      }

      return result;
      
    } catch (err) {
      const apiError = enhancedNormalizeError(err, finalOptions.operation || 'API call');
      setError(apiError);

      // Show error handling based on error type and options
      if (finalOptions.showErrorToast !== false) {
        handleErrorDisplay(apiError, finalOptions);
      }

      return null;
      
    } finally {
      setLoading(false);
    }
  }, [online, connectionQuality, defaultOptions]);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastOperation) {
      console.warn('No operation to retry');
      return;
    }

    setIsRetrying(true);
    
    try {
      // First try to restore network connection if offline
      if (!online) {
        await retryNow();
        
        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Then retry the last operation
      await execute(lastOperation, { ...defaultOptions, showErrorToast: true });
      
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      
      // Show retry failure message
      toast({
        title: "Retry Failed",
        description: "Unable to complete the operation. Please try again later.",
        variant: "destructive"
      });
      
    } finally {
      setIsRetrying(false);
    }
  }, [lastOperation, online, retryNow, execute, defaultOptions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    loading,
    error,
    retry,
    clearError,
    isRetrying
  };
}

// Enhanced error normalization with better categorization
function enhancedNormalizeError(error: unknown, operation: string): ApiError {
  // Use the base normalization first
  const baseError = normalizeError(error, operation);
  
  // Add enhanced handling for specific error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Enhanced network error detection
    if (message.includes('failed to fetch') ||
        message.includes('network request failed') ||
        message.includes('err_network') ||
        message.includes('err_internet_disconnected') ||
        message.includes('net::err_') ||
        message.includes('TypeError: fetch')) {
      
      return new ApiError(
        'Connection lost. Please check your internet connection.',
        ERROR_CODES.NETWORK_OFFLINE,
        true,
        { 
          operation, 
          originalMessage: error.message,
          errorType: 'network_failure',
          timestamp: Date.now()
        }
      );
    }
    
    // Enhanced timeout detection
    if (message.includes('timeout') ||
        message.includes('aborted') ||
        message.includes('request took too long')) {
      
      return new ApiError(
        'Request timed out. Please try again.',
        ERROR_CODES.TIMEOUT,
        true,
        { 
          operation, 
          originalMessage: error.message,
          errorType: 'timeout',
          timestamp: Date.now()
        }
      );
    }
    
    // Server error detection with status codes
    if (message.includes('500') || message.includes('internal server error')) {
      return new ApiError(
        'Server error occurred. Please try again in a moment.',
        ERROR_CODES.SERVER_ERROR,
        true,
        { operation, statusCode: 500, timestamp: Date.now() }
      );
    }
    
    if (message.includes('502') || message.includes('bad gateway')) {
      return new ApiError(
        'Server temporarily unavailable. Retrying automatically.',
        ERROR_CODES.SERVER_ERROR,
        true,
        { operation, statusCode: 502, timestamp: Date.now() }
      );
    }
    
    if (message.includes('503') || message.includes('service unavailable')) {
      return new ApiError(
        'Service temporarily unavailable. Please try again shortly.',
        ERROR_CODES.SERVER_ERROR,
        true,
        { operation, statusCode: 503, timestamp: Date.now() }
      );
    }
  }
  
  return baseError;
}

// Enhanced error display handling
function handleErrorDisplay(error: ApiError, options: UseNetworkApiOptions) {
  const message = getUserFriendlyMessage(error);
  
  // Handle different error types with appropriate UI
  switch (error.code) {
    case ERROR_CODES.NETWORK_OFFLINE:
      toast({
        title: "Connection Lost",
        description: message,
        variant: "default",
        action: {
          altText: "Retry connection",
          children: "Retry",
          onClick: () => {
            if (window.networkContext?.retryNow) {
              window.networkContext.retryNow().catch(console.error);
            }
          }
        } as any
      });
      break;
      
    case ERROR_CODES.TIMEOUT:
      toast({
        title: "Request Timeout",
        description: message,
        variant: "default",
        action: {
          altText: "Try again",
          children: "Retry",
          onClick: () => {
            // This will be handled by the retry mechanism
            console.log('Timeout retry requested');
          }
        } as any
      });
      break;
      
    case ERROR_CODES.SERVER_ERROR:
      if (error.retryable) {
        toast({
          title: "Server Issue",
          description: message,
          variant: "default"
        });
      } else {
        toast({
          title: "Server Error",
          description: message,
          variant: "destructive"
        });
      }
      break;
      
    case ERROR_CODES.VALIDATION_ERROR:
      // Don't show toast for validation errors - handle in form
      console.warn('Validation error in API call:', message);
      break;
      
    case ERROR_CODES.QUEUED_OFFLINE:
      toast({
        title: "Saved Offline",
        description: message,
        variant: "default"
      });
      break;
      
    default:
      if (error.retryable && options.retryOnError !== false) {
        showNetworkErrorToast(error, () => {
          console.log('Error toast retry requested');
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive"
        });
      }
  }
}

// Specialized hooks for common operations
export function useNetworkRead<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    requireOnline: true,
    showErrorToast: true,
    retryOnError: true,
    operation: 'read data',
    ...options
  });
}

export function useNetworkWrite<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    showSuccessToast: true,
    showErrorToast: true,
    retryOnError: true,
    operation: 'save data',
    ...options
  });
}

export function useNetworkDelete<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    requireOnline: true,
    showSuccessToast: true,
    showErrorToast: true,
    retryOnError: false, // Deletes should be confirmed, not auto-retried
    operation: 'delete data',
    ...options
  });
}

export default useNetworkApi;

// Global reference for network context access
if (typeof window !== 'undefined') {
  (window as any).networkContext = null; // Will be set by NetworkProvider
}
