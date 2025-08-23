
import { useCallback, useState } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { apiClient } from '@/lib/network/client';
import { toast } from '@/hooks/use-toast';
import { ApiError, ERROR_CODES, getUserFriendlyMessage } from '@/lib/errors';
import { showNetworkErrorToast } from '@/components/network/NetworkErrorToast';

interface UseNetworkApiOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  requireOnline?: boolean;
  retryOnError?: boolean;
}

interface UseNetworkApiReturn<T> {
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  loading: boolean;
  error: ApiError | null;
  retry: () => Promise<void>;
  clearError: () => void;
}

export function useNetworkApi<T = any>(
defaultOptions: UseNetworkApiOptions = {})
: UseNetworkApiReturn<T> {
  const { online, retryNow } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastOperation, setLastOperation] = useState<(() => Promise<T>) | null>(null);

  const execute = useCallback(async (
  operation: () => Promise<T>,
  options: UseNetworkApiOptions = {})
  : Promise<T | null> => {
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
          true
        );
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
      const apiError = normalizeError(err);
      setError(apiError);

      // Show error toast with retry option
      if (finalOptions.showErrorToast !== false) {
        if (apiError.retryable && finalOptions.retryOnError !== false) {
          showNetworkErrorToast(apiError, () => retry());
        } else {
          toast({
            title: "Error",
            description: getUserFriendlyMessage(apiError),
            variant: "destructive"
          });
        }
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [online, defaultOptions]);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastOperation) {
      console.warn('No operation to retry');
      return;
    }

    // First try to restore network connection
    if (!online) {
      try {
        await retryNow();
      } catch (networkError) {
        console.error('Network retry failed:', networkError);
      }
    }

    // Then retry the last operation
    await execute(lastOperation, { ...defaultOptions, showErrorToast: true });
  }, [lastOperation, online, retryNow, execute, defaultOptions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    loading,
    error,
    retry,
    clearError
  };
}

// Helper function to normalize errors
function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for network-related errors
    if (error.name === 'TypeError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('ERR_NETWORK')) {
      return new ApiError(
        'Connection lost. Your changes will be saved offline.',
        ERROR_CODES.NETWORK_OFFLINE,
        true
      );
    }

    // Check for timeout errors
    if (error.name === 'AbortError' ||
    error.message.includes('timeout') ||
    error.message.includes('aborted')) {
      return new ApiError(
        'Request timeout. Please check your connection and try again.',
        ERROR_CODES.TIMEOUT,
        true
      );
    }

    return new ApiError(
      error.message,
      ERROR_CODES.UNKNOWN_ERROR,
      false
    );
  }

  return new ApiError(
    'An unexpected error occurred',
    ERROR_CODES.UNKNOWN_ERROR,
    false
  );
}

// Specialized hooks for common operations
export function useNetworkRead<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    requireOnline: true,
    showErrorToast: true,
    retryOnError: true,
    ...options
  });
}

export function useNetworkWrite<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    showSuccessToast: true,
    showErrorToast: true,
    retryOnError: true,
    ...options
  });
}

export function useNetworkDelete<T = any>(options: UseNetworkApiOptions = {}) {
  return useNetworkApi<T>({
    requireOnline: true,
    showSuccessToast: true,
    showErrorToast: true,
    retryOnError: false, // Deletes should be confirmed, not auto-retried
    ...options
  });
}

export default useNetworkApi;