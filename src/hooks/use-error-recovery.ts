
import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error, attempt: number) => void;
  onMaxRetriesReached?: (error: Error) => void;
  onSuccess?: () => void;
}

interface ErrorRecoveryState {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  hasError: boolean;
}

export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onMaxRetriesReached,
    onSuccess
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    hasError: false
  });

  const setError = useCallback((error: Error | string | null) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    setState(prev => ({
      ...prev,
      error: errorObj,
      hasError: !!error,
      retryCount: error ? prev.retryCount : 0
    }));

    if (error && onError) {
      onError(errorObj, state.retryCount);
    }
  }, [onError, state.retryCount]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      hasError: false,
      retryCount: 0,
      isRetrying: false
    }));

    if (onSuccess) {
      onSuccess();
    }
  }, [onSuccess]);

  const retry = useCallback(async (retryFn?: () => Promise<void>) => {
    if (state.retryCount >= maxRetries) {
      if (onMaxRetriesReached && state.error) {
        onMaxRetriesReached(state.error);
      }
      
      toast({
        title: "Maximum Retries Reached",
        description: "Please try refreshing the page or contact support if the problem persists.",
        variant: "destructive"
      });
      
      return false;
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }));

    try {
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      if (retryFn) {
        await retryFn();
      }
      
      // If we get here, the retry was successful
      clearError();
      
      toast({
        title: "Recovery Successful",
        description: "The issue has been resolved.",
        variant: "default"
      });
      
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      setState(prev => ({
        ...prev,
        error: errorObj,
        isRetrying: false
      }));

      if (onError) {
        onError(errorObj, state.retryCount + 1);
      }

      return false;
    }
  }, [state.retryCount, state.error, maxRetries, retryDelay, onError, onMaxRetriesReached, clearError]);

  const forceRetry = useCallback(async (retryFn?: () => Promise<void>) => {
    // Reset retry count for force retry
    setState(prev => ({
      ...prev,
      retryCount: 0,
      isRetrying: true
    }));

    try {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      if (retryFn) {
        await retryFn();
      }
      
      clearError();
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setError(errorObj);
      return false;
    }
  }, [retryDelay, clearError, setError]);

  // Auto-clear error after successful operations
  useEffect(() => {
    if (!state.hasError && state.retryCount > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, retryCount: 0 }));
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [state.hasError, state.retryCount]);

  return {
    ...state,
    setError,
    clearError,
    retry,
    forceRetry,
    canRetry: state.retryCount < maxRetries,
    retriesLeft: Math.max(0, maxRetries - state.retryCount)
  };
}

export default useErrorRecovery;
