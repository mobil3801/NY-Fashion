
import { ApiError } from '@/lib/errors';

/**
 * Enhanced RetryableError class for better error tracking
 */
export class RetryableError extends Error {
  public readonly attempt: number;
  public readonly maxAttempts: number;
  public readonly canRetry: boolean;
  public readonly originalError: Error;
  public readonly operation?: string;

  constructor(
  originalError: Error,
  attempt: number,
  maxAttempts: number,
  operation?: string)
  {
    super(originalError.message);
    this.name = 'RetryableError';
    this.originalError = originalError;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.canRetry = attempt < maxAttempts;
    this.operation = operation;
  }
}

/**
 * Creates user-friendly error messages from various error types
 */
export function createUserFriendlyErrorMessage(error: Error | ApiError | RetryableError): string {
  // Handle RetryableError
  if (error instanceof RetryableError) {
    return createUserFriendlyErrorMessage(error.originalError);
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK_OFFLINE':
        return 'You appear to be offline. Please check your internet connection.';
      case 'TIMEOUT':
        return 'The request timed out. Please try again.';
      case 'SERVER_ERROR':
        return 'Server is temporarily unavailable. Please try again in a moment.';
      case 'CLIENT_ERROR':
        return 'There was an issue with your request. Please check your input and try again.';
      case 'VALIDATION_ERROR':
        return error.message || 'Please check your input and try again.';
      case 'PERMISSION_DENIED':
        return "You don't have permission to perform this action.";
      case 'QUEUED_OFFLINE':
        return 'Your changes have been saved and will sync when you\'re back online.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // Handle generic Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network connection issue. Please check your internet and try again.';
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }

    // Abort errors
    if (message.includes('abort')) {
      return 'Request was cancelled.';
    }

    // Generic fallback
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determines if an error should trigger retry logic
 */
export function shouldRetry(error: Error | ApiError, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;

  // Handle ApiError
  if (error instanceof ApiError) {
    return error.retryable;
  }

  // Handle generic errors
  const message = error.message.toLowerCase();

  // Don't retry validation or permission errors
  if (message.includes('validation') ||
  message.includes('permission') ||
  message.includes('forbidden') ||
  message.includes('unauthorized')) {
    return false;
  }

  // Don't retry abort errors
  if (message.includes('abort')) {
    return false;
  }

  // Retry network and timeout errors
  return true;
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateRetryDelay(
attempt: number,
baseDelay: number = 300,
maxDelay: number = 10000,
jitter: boolean = true)
: number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

  if (!jitter) return exponentialDelay;

  // Add jitter (randomness) to prevent thundering herd
  return Math.floor(exponentialDelay * (0.5 + Math.random() * 0.5));
}

/**
 * Sleep utility that can be cancelled
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sleep aborted'));
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
      reject(new Error('Sleep aborted'));
    };

    signal?.addEventListener('abort', abortHandler, { once: true });
  });
}