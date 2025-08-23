
export interface RetryConfig {
  maxAttempts?: number;
  timeout?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export interface RetryState {
  attempt: number;
  isRetrying: boolean;
  error: Error | null;
  canRetry: boolean;
}

export interface RetryOptions extends RetryConfig {
  onRetry?: (attempt: number, error: Error) => void;
  onSuccess?: () => void;
  onMaxAttemptsReached?: (error: Error) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  timeout: 10000, // 10 seconds
  baseDelay: 1000, // 1 second
  maxDelay: 8000   // 8 seconds max
};

export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly attempt: number,
    public readonly maxAttempts: number,
    public readonly canRetry: boolean = true
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

export class ApiRetryManager {
  private abortController: AbortController | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  
  constructor(private config: Required<RetryConfig> = DEFAULT_CONFIG) {}

  async executeWithRetry<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const finalConfig = { ...this.config, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        // Clean up previous attempt
        this.cleanup();
        
        // Create new abort controller for this attempt
        this.abortController = new AbortController();
        
        // Set up timeout
        this.timeoutId = setTimeout(() => {
          if (this.abortController && !this.abortController.signal.aborted) {
            this.abortController.abort();
          }
        }, finalConfig.timeout);

        // Execute the operation
        const result = await operation(this.abortController.signal);
        
        // Success - cleanup and return
        this.cleanup();
        options.onSuccess?.();
        return result;

      } catch (error) {
        // Always cleanup on error
        this.cleanup();

        const errorToHandle = this.processError(error);
        lastError = errorToHandle;

        // Log the error with context
        console.error(`API Retry Manager - Attempt ${attempt}/${finalConfig.maxAttempts} failed:`, {
          error: errorToHandle,
          attempt,
          maxAttempts: finalConfig.maxAttempts,
          canRetry: this.shouldRetry(errorToHandle, attempt, finalConfig.maxAttempts)
        });

        // Don't retry if it's the last attempt or if error is non-retryable
        if (attempt === finalConfig.maxAttempts || !this.shouldRetry(errorToHandle, attempt, finalConfig.maxAttempts)) {
          if (attempt === finalConfig.maxAttempts) {
            options.onMaxAttemptsReached?.(errorToHandle);
          }
          throw new RetryableError(
            errorToHandle.message,
            attempt,
            finalConfig.maxAttempts,
            false
          );
        }

        // Notify about retry
        options.onRetry?.(attempt, errorToHandle);

        // Wait before retrying with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(2, attempt - 1),
          finalConfig.maxDelay
        );
        
        await this.delay(delay);
      }
    }

    // This should never be reached, but just in case
    throw lastError!;
  }

  private processError(error: unknown): Error {
    if (error instanceof Error) {
      // Check if it's an abort error (timeout or cancellation)
      if (error.name === 'AbortError') {
        return new TimeoutError(this.config.timeout);
      }
      
      // Check if it's an HTTP error that shouldn't be retried
      if ('status' in error && typeof error.status === 'number') {
        const status = error.status as number;
        if (status >= 400 && status < 500) {
          // 4xx errors are client errors - don't retry
          return new NonRetryableError(error.message, status);
        }
      }
      
      return error;
    }

    // Convert unknown errors to Error objects
    return new Error(String(error));
  }

  private shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean {
    // Don't retry if max attempts reached
    if (attempt >= maxAttempts) {
      return false;
    }

    // Don't retry non-retryable errors
    if (error instanceof NonRetryableError) {
      return false;
    }

    // Don't retry 4xx errors (client errors)
    if ('status' in error && typeof error.status === 'number') {
      const status = error.status as number;
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // Retry all other errors (network errors, 5xx errors, timeouts)
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    this.abortController = null;
  }

  // Public method to cancel ongoing operations
  cancel(): void {
    this.cleanup();
  }

  // Static convenience method
  static async execute<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const manager = new ApiRetryManager();
    try {
      return await manager.executeWithRetry(operation, options);
    } finally {
      manager.cancel();
    }
  }
}

// Helper function to create user-friendly error messages
export function createUserFriendlyErrorMessage(error: Error): string {
  if (error instanceof TimeoutError) {
    return "Request timed out. Please check your internet connection and try again.";
  }
  
  if (error instanceof NonRetryableError) {
    if (error.statusCode === 401) {
      return "Authentication required. Please log in again.";
    }
    if (error.statusCode === 403) {
      return "You don't have permission to perform this action.";
    }
    if (error.statusCode === 404) {
      return "The requested resource was not found.";
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return "Invalid request. Please check your input and try again.";
    }
  }
  
  if (error instanceof RetryableError) {
    if (!error.canRetry) {
      return `Failed after ${error.attempt} attempts. Please try again later.`;
    }
    return `Retrying request (attempt ${error.attempt}/${error.maxAttempts})...`;
  }
  
  // Generic network/server error
  if (error.message.toLowerCase().includes('network') || 
      error.message.toLowerCase().includes('fetch')) {
    return "Network error. Please check your internet connection.";
  }
  
  return "An unexpected error occurred. Please try again.";
}
