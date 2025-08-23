
import { useCallback, useRef, useEffect, useState } from 'react';
import { NetworkErrorClassifier } from '@/lib/network/error-classifier';
import { ConnectionErrorType } from '@/types/network';

interface RetryConfig {
  maxRetries?: number;
  onRetryAttempt?: (attempt: number, errorType: ConnectionErrorType) => void;
  onMaxRetriesReached?: (errorType: ConnectionErrorType) => void;
  onSuccess?: () => void;
}

export function useNetworkRetry(config: RetryConfig = {}) {
  const {
    maxRetries = 5,
    onRetryAttempt,
    onMaxRetriesReached,
    onSuccess
  } = config;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentError, setCurrentError] = useState<ConnectionErrorType | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }
  }, []);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName = 'Network operation'
  ): Promise<T> => {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      setRetryCount(attempt);
      
      try {
        // Create abort controller for this attempt
        abortControllerRef.current = new AbortController();
        
        const result = await operation();
        
        // Success - reset state
        setIsRetrying(false);
        setRetryCount(0);
        setCurrentError(null);
        clearRetry();
        
        if (attempt > 1) {
          onSuccess?.();
        }
        
        return result;
      } catch (error) {
        const errorDetails = NetworkErrorClassifier.classifyError(error);
        setCurrentError(errorDetails.type);
        
        // Log the attempt
        console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, {
          error: errorDetails.message,
          type: errorDetails.type,
          isRetryable: errorDetails.isRetryable
        });
        
        // If not retryable or max attempts reached, throw
        if (!errorDetails.isRetryable || attempt >= maxRetries) {
          setIsRetrying(false);
          if (attempt >= maxRetries) {
            onMaxRetriesReached?.(errorDetails.type);
          }
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = NetworkErrorClassifier.getRetryDelay(errorDetails.type, attempt);
        
        setIsRetrying(true);
        onRetryAttempt?.(attempt, errorDetails.type);
        
        // Wait before retry
        await new Promise((resolve) => {
          retryTimeoutRef.current = setTimeout(resolve, delay);
        });
        
        // Check if we should continue (not aborted)
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }, [maxRetries, onRetryAttempt, onMaxRetriesReached, onSuccess, clearRetry]);

  const abortRetry = useCallback(() => {
    clearRetry();
    setIsRetrying(false);
    setRetryCount(0);
    setCurrentError(null);
  }, [clearRetry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetry();
    };
  }, [clearRetry]);

  return {
    executeWithRetry,
    abortRetry,
    isRetrying,
    retryCount,
    currentError,
    maxRetries
  };
}
