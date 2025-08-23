
import { useCallback, useRef, useEffect, useContext } from 'react';
import { normalizeError, isRetryable, logApiEvent, type ApiError } from '@/lib/errors';

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable: (e: unknown) => boolean;
  signal?: AbortSignal;
  onAttempt?: (info: {attempt: number;error?: ApiError;}) => void;
  onGiveUp?: (e: unknown) => void;
}

export interface RetryContext {
  signal: AbortSignal;
  attempt: number;
  isLastAttempt: boolean;
}

/**
 * Default retry options with exponential backoff
 */
const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = {
  attempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 10000,
  isRetryable: isRetryable
};

/**
 * Sleep function that respects AbortSignal
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortHandler);
    };

    const abortHandler = () => {
      cleanup();
      reject(new Error('Aborted'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });
  });
}

/**
 * Calculate delay with exponential backoff and full jitter
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Apply full jitter: random value between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}

/**
 * Creates a composite AbortController that listens to multiple signals
 */
function createCompositeAbortController(signals: (AbortSignal | undefined)[]): AbortController {
  const controller = new AbortController();

  const validSignals = signals.filter((signal): signal is AbortSignal =>
  signal !== undefined && !signal.aborted
  );

  // If any signal is already aborted, abort immediately
  if (validSignals.some((signal) => signal.aborted)) {
    controller.abort();
    return controller;
  }

  // Listen to all signals
  const abortHandlers = validSignals.map((signal) => {
    const handler = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };
    signal.addEventListener('abort', handler, { once: true });
    return { signal, handler };
  });

  // Cleanup listeners when our controller is aborted
  controller.signal.addEventListener('abort', () => {
    abortHandlers.forEach(({ signal, handler }) => {
      signal.removeEventListener('abort', handler);
    });
  }, { once: true });

  return controller;
}

/**
 * Execute a function with retry logic using exponential backoff and full jitter
 */
export async function executeWithRetry<T>(
fn: (ctx: RetryContext) => Promise<T>,
options: RetryOptions)
: Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { attempts, baseDelayMs, maxDelayMs, isRetryable: shouldRetry, signal, onAttempt, onGiveUp } = opts;

  // Create composite abort controller
  const compositeController = createCompositeAbortController([signal]);

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const isLastAttempt = attempt === attempts;

    try {
      // Check if aborted before starting attempt
      if (compositeController.signal.aborted) {
        throw new Error('Aborted');
      }

      const result = await fn({
        signal: compositeController.signal,
        attempt,
        isLastAttempt
      });

      // Success - cleanup and return
      compositeController.abort(); // Cleanup listeners
      return result;

    } catch (error) {
      lastError = error;
      const normalizedError = normalizeError(error, 'retry-operation');

      // Log the attempt
      logApiEvent({
        operation: 'executeWithRetry',
        attempt,
        statusCode: normalizedError.type === 'http' ? (normalizedError as any).statusCode : undefined,
        retryable: shouldRetry(error) && !isLastAttempt,
        message: normalizedError.message,
        error: normalizedError
      });

      // Call onAttempt callback
      onAttempt?.({ attempt, error: normalizedError });

      // Don't retry if aborted
      if (normalizedError.type === 'abort') {
        compositeController.abort();
        throw error;
      }

      // Don't retry if not retryable or last attempt
      if (!shouldRetry(error) || isLastAttempt) {
        break;
      }

      // Calculate delay with exponential backoff and full jitter
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);

      try {
        await sleep(delayMs, compositeController.signal);
      } catch (sleepError) {
        // Sleep was aborted
        compositeController.abort();
        throw sleepError;
      }
    }
  }

  // All attempts failed
  compositeController.abort(); // Cleanup listeners
  onGiveUp?.(lastError);
  throw lastError;
}

/**
 * Hook that provides retry capabilities with proper cleanup
 */
export function useApiRetry() {
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  const isMountedRef = useRef(true);

  // Try to get debug context, but don't fail if it's not available
  let debugContext: any = null;
  try {
    // We can't directly import useDebug here due to circular dependency
    // Instead, we'll access it through React context if available
    const DebugContext = require('@/contexts/DebugContext').DebugContext;
    debugContext = useContext(DebugContext);
  } catch {




















    // Debug context not available, continue without it
  } // Cleanup on unmount
  useEffect(() => {isMountedRef.current = true;return () => {isMountedRef.current = false; // Abort all ongoing operations
        abortControllersRef.current.forEach((controller) => {if (!controller.signal.aborted) {controller.abort();}});abortControllersRef.current.clear();};}, []);const executeWithRetry = useCallback(async <T,>(fn: (ctx: RetryContext) => Promise<T>, options?: Partial<RetryOptions> & {operation?: string;url?: string;method?: string;}): Promise<T> => {if (!isMountedRef.current) {
        throw new Error('Component is unmounted');
      }

      const controller = new AbortController();
      abortControllersRef.current.add(controller);

      // Track API call in debug system if available
      let debugCallId: string | null = null;
      if (debugContext?.addApiCall) {
        debugCallId = debugContext.addApiCall({
          timestamp: new Date(),
          operation: options?.operation || 'unknown',
          method: options?.method || 'GET',
          url: options?.url || 'unknown',
          attempt: 1,
          duration: null,
          status: 'pending'
        });
      }

      try {
        const result = await executeWithRetry(fn, {
          ...DEFAULT_RETRY_OPTIONS,
          ...options,
          signal: controller.signal,
          onAttempt: (info) => {
            if (isMountedRef.current) {
              // Update debug tracking
              if (debugCallId && debugContext?.updateApiCall) {
                debugContext.updateApiCall(debugCallId, {
                  attempt: info.attempt,
                  status: info.error ? 'retrying' : 'pending',
                  error: info.error
                });
              }
              options?.onAttempt?.(info);
            }
          },
          onGiveUp: (error) => {
            if (isMountedRef.current) {
              // Update debug tracking
              if (debugCallId && debugContext?.updateApiCall) {
                debugContext.updateApiCall(debugCallId, {
                  status: 'error',
                  error: normalizeError(error),
                  duration: performance.now()
                });
              }
              options?.onGiveUp?.(error);
            }
          }
        } as RetryOptions);

        // Update debug tracking on success
        if (debugCallId && debugContext?.updateApiCall) {
          debugContext.updateApiCall(debugCallId, {
            status: 'success',
            duration: performance.now()
          });
        }

        return result;
      } finally {
        abortControllersRef.current.delete(controller);
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }
    }, []);

  const abortAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    abortControllersRef.current.clear();
  }, []);

  return {
    executeWithRetry,
    abortAll,
    isMounted: () => isMountedRef.current
  };
}

/**
 * Hook for creating a managed AbortController with automatic cleanup
 */
export function useManagedAbortController() {
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (controllerRef.current && !controllerRef.current.signal.aborted) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const getController = useCallback(() => {
    if (!isMountedRef.current) {
      throw new Error('Component is unmounted');
    }

    if (!controllerRef.current || controllerRef.current.signal.aborted) {
      controllerRef.current = new AbortController();
    }

    return controllerRef.current;
  }, []);

  const abort = useCallback(() => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }
    if (isMountedRef.current) {
      controllerRef.current = new AbortController();
    }
  }, []);

  return {
    getController,
    abort,
    reset,
    signal: controllerRef.current?.signal,
    isMounted: () => isMountedRef.current
  };
}