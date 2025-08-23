
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
  maxDelay: 8000 // 8 seconds max
};

export class RetryableError extends Error {
  constructor(
  message: string,
  public readonly attempt: number,
  public readonly maxAttempts: number,
  public readonly canRetry: boolean = true)
  {
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
  private static instance: ApiRetryManager;
  private retryAttempts = new Map<string, number>();
  private abortControllers = new Map<string, AbortController>();

  static getInstance(): ApiRetryManager {
    if (!ApiRetryManager.instance) {
      ApiRetryManager.instance = new ApiRetryManager();
    }
    return ApiRetryManager.instance;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000,
    operationId?: string
  ): Promise<T> {
    const opId = operationId || `op_${Date.now()}_${Math.random()}`;
    
    // Cancel any existing operation with the same ID
    this.cancelOperation(opId);
    
    const controller = new AbortController();
    this.abortControllers.set(opId, controller);
    
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Check if operation was cancelled
        if (controller.signal.aborted) {
          throw new Error('Operation cancelled');
        }
        
        try {
          const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
              // 30 second timeout
              setTimeout(() => reject(new Error('Request timeout')), 30000);
            })
          ]);
          
          // Success - cleanup and return
          this.retryAttempts.delete(opId);
          this.abortControllers.delete(opId);
          return result;
          
        } catch (error: any) {
          console.log('API Retry Manager - Attempt', attempt + '/' + maxAttempts, 'failed:', { 
            error: error.message || error, 
            attempt, 
            maxAttempts, 
            canRetry: attempt < maxAttempts 
          });
          
          // Don't retry on 4xx errors (client errors)
          if (error.status >= 400 && error.status < 500) {
            throw new RetryableError(`Client error: ${error.message || 'Request failed'}`);
          }
          
          if (attempt === maxAttempts) {
            throw new RetryableError(
              'Unable to complete request after multiple attempts. Please check your connection and try again.'
            );
          }
          
          // Check if cancelled before waiting
          if (controller.signal.aborted) {
            throw new Error('Operation cancelled');
          }
          
          // Wait before retrying with exponential backoff (capped at 5 seconds)
          const backoffDelay = Math.min(delay * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, backoffDelay);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Operation cancelled'));
            });
          });
        }
      }
    } finally {
      // Cleanup
      this.retryAttempts.delete(opId);
      this.abortControllers.delete(opId);
    }
    
    throw new RetryableError('Maximum retry attempts exceeded');
  }

  cancelOperation(operationId: string): void {
    const controller = this.abortControllers.get(operationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(operationId);
      this.retryAttempts.delete(operationId);
    }
  }

  cancelAllOperations(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
    this.retryAttempts.clear();
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  options: RetryOptions = {})
  : Promise<T> {
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