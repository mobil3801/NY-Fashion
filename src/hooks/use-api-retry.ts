
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRetryManager, RetryOptions, RetryableError } from '@/utils/apiRetry';
import { useRetryBanner } from '@/components/ui/retry-banner';

export interface UseApiRetryOptions extends RetryOptions {
  autoRetry?: boolean;
  showBanner?: boolean;
}

export interface UseApiRetryReturn<T> {
  execute: (operation: (signal: AbortSignal) => Promise<T>) => Promise<T>;
  retry: () => Promise<void>;
  cancel: () => void;
  loading: boolean;
  error: Error | null;
  data: T | null;
  canRetry: boolean;
  isRetrying: boolean;
  bannerProps: {
    error: Error | null;
    isRetrying: boolean;
    onRetry?: () => void;
    onDismiss?: () => void;
  };
}

export function useApiRetry<T = any>(options: UseApiRetryOptions = {}): UseApiRetryReturn<T> {
  const {
    autoRetry = true,
    showBanner = true,
    maxAttempts = 3,
    timeout = 10000,
    ...retryOptions
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const retryManagerRef = useRef<ApiRetryManager | null>(null);
  const lastOperationRef = useRef<((signal: AbortSignal) => Promise<T>) | null>(null);
  const mountedRef = useRef(true);

  const banner = useRetryBanner();

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryManagerRef.current?.cancel();
    };
  }, []);

  const resetState = useCallback(() => {
    if (!mountedRef.current) return;
    setError(null);
    setData(null);
    setCanRetry(false);
    setIsRetrying(false);
    if (showBanner) {
      banner.hideError();
    }
  }, [showBanner, banner]);

  const execute = useCallback(async (operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (!mountedRef.current) return Promise.reject(new Error('Component unmounted'));

    // Store the operation for potential retry
    lastOperationRef.current = operation;

    // Cancel any existing operation
    retryManagerRef.current?.cancel();

    // Reset state
    resetState();
    setLoading(true);

    // Create new retry manager
    const operationId = `hook_${Date.now()}_${Math.random()}`;
    retryManagerRef.current = new ApiRetryManager({ maxAttempts, timeout });

    try {
      const result = await retryManagerRef.current.executeWithRetry(operation, {
        ...retryOptions,
        operationId,
        maxAttempts,
        timeout,
        onRetry: (attempt, retryError) => {
          if (!mountedRef.current) return;

          console.log(`Retrying operation - attempt ${attempt}`, retryError);
          setIsRetrying(true);
          setError(retryError);
          setCanRetry(true);

          retryOptions.onRetry?.(attempt, retryError);
        },
        onSuccess: () => {
          if (!mountedRef.current) return;

          resetState();
          retryOptions.onSuccess?.();
        },
        onMaxAttemptsReached: (maxError) => {
          if (!mountedRef.current) return;

          setCanRetry(false);
          setIsRetrying(false);

          retryOptions.onMaxAttemptsReached?.(maxError);
        }
      });

      if (!mountedRef.current) return Promise.reject(new Error('Component unmounted'));

      setData(result);
      setLoading(false);
      return result;

    } catch (executeError) {
      if (!mountedRef.current) return Promise.reject(executeError);

      const finalError = executeError instanceof Error ? executeError : new Error(String(executeError));

      setError(finalError);
      setLoading(false);
      setIsRetrying(false);

      // Determine if we can retry based on error type and autoRetry setting
      const canRetryNow = autoRetry && !(finalError instanceof RetryableError && !finalError.canRetry);
      setCanRetry(canRetryNow);

      throw finalError;
    }
  }, [maxAttempts, timeout, retryOptions, autoRetry, showBanner, resetState]);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastOperationRef.current) {
      console.warn('No operation to retry');
      return;
    }

    try {
      await execute(lastOperationRef.current);
    } catch (error) {
      // Error is already handled in execute
      console.error('Retry failed:', error);
    }
  }, [execute]);

  const cancel = useCallback(() => {
    retryManagerRef.current?.cancel();
    if (mountedRef.current) {
      setLoading(false);
      setIsRetrying(false);
    }
  }, []);

  const handleBannerRetry = useCallback(() => {
    if (canRetry || error instanceof RetryableError && !error.canRetry) {
      retry();
    }
  }, [canRetry, error, retry]);

  const handleBannerDismiss = useCallback(() => {
    if (showBanner) {
      banner.dismissError();
    }
  }, [showBanner, banner]);

  useEffect(() => {
    return () => {
      // Cancel all operations when component unmounts
      retryManagerRef.current?.cancel();
    };
  }, []);

  return {
    execute,
    retry,
    cancel,
    loading,
    error,
    data,
    canRetry,
    isRetrying,
    bannerProps: {
      error: error,
      isRetrying: isRetrying,
      onRetry: canRetry ? handleBannerRetry : undefined,
      onDismiss: handleBannerDismiss
    }
  };
}