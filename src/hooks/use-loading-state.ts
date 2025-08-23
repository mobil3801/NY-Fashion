
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_CONFIG } from '@/config/production';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  data: any;
}

interface UseLoadingStateOptions {
  initialLoading?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  debounceMs?: number;
}

export function useLoadingState<T = any>(options: UseLoadingStateOptions = {}) {
  const {
    initialLoading = false,
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true,
    debounceMs = PRODUCTION_CONFIG.ui.loadingDebounce,
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: initialLoading,
    error: null,
    data: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Execute async operation with loading state management
  const execute = useCallback(async (
    operation: (signal?: AbortSignal) => Promise<T>,
    options?: { immediate?: boolean }
  ): Promise<T | null> => {
    // Cleanup any existing operation
    cleanup();

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Set loading state with optional debounce
    const setLoading = () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    };

    if (options?.immediate || debounceMs === 0) {
      setLoading();
    } else {
      timeoutRef.current = setTimeout(setLoading, debounceMs);
    }

    try {
      const result = await operation(signal);
      
      // Check if aborted
      if (signal.aborted) {
        return null;
      }

      setState({
        isLoading: false,
        error: null,
        data: result,
      });

      onSuccess?.(result);
      
      if (showSuccessToast) {
        toast({
          title: "Success",
          description: "Operation completed successfully",
        });
      }

      return result;
    } catch (error: any) {
      // Check if aborted
      if (signal.aborted) {
        return null;
      }

      const errorMessage = error.message || 'An unexpected error occurred';
      
      setState({
        isLoading: false,
        error: errorMessage,
        data: null,
      });

      onError?.(errorMessage);

      if (showErrorToast) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }

      throw error;
    } finally {
      // Clear timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [cleanup, debounceMs, onSuccess, onError, showSuccessToast, showErrorToast]);

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setState({
      isLoading: false,
      error: null,
      data: null,
    });
  }, [cleanup]);

  // Set loading manually
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  // Set error manually
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  }, []);

  // Set data manually
  const setData = useCallback((data: any) => {
    setState(prev => ({ ...prev, data, error: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    execute,
    reset,
    setLoading,
    setError,
    setData,
    abort: cleanup,
  };
}

// Hook for simple async operations
export function useAsyncOperation<T = any>(
  operation: () => Promise<T>,
  dependencies: any[] = [],
  options: UseLoadingStateOptions = {}
) {
  const loadingState = useLoadingState<T>(options);

  useEffect(() => {
    if (operation) {
      loadingState.execute(operation);
    }
  }, dependencies);

  return loadingState;
}

// Hook for manual async operations
export function useManualAsyncOperation<T = any>(
  options: UseLoadingStateOptions = {}
) {
  return useLoadingState<T>(options);
}

export default useLoadingState;
