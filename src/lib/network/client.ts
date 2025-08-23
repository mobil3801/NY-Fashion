
import { isOfflineError, calculateBackoffDelay } from './connectivity';
import { OfflineQueue, QueuedOperation } from '@/lib/offlineQueue';
import { normalizeError, ApiError } from '@/lib/errors';

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryDelayMax?: number;
  retryFactor?: number;
}

export interface ApiClientOptions extends RequestInit {
  timeout?: number;
  skipRetry?: boolean;
  skipOfflineQueue?: boolean;
  idempotencyKey?: string;
}

export interface RetryScheduler {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  scheduleRetry(fn: () => Promise<void>, attempt: number): number;
  clearRetry(id: number): void;
}

class NetworkRetryScheduler implements RetryScheduler {
  private paused = false;
  private pendingRetries = new Map<number, number>();
  private nextId = 1;

  pause(): void {
    this.paused = true;
    // Clear all pending retries but keep track of them
    this.pendingRetries.forEach((timerId) => clearTimeout(timerId));
    this.pendingRetries.clear();
  }

  resume(): void {
    this.paused = false;
    // Note: Caller should re-schedule retries after resume
  }

  isPaused(): boolean {
    return this.paused;
  }

  scheduleRetry(fn: () => Promise<void>, attempt: number): number {
    if (this.paused) {
      return -1; // Indicate retry was not scheduled
    }

    const delay = calculateBackoffDelay(attempt);
    const id = this.nextId++;

    const timerId = window.setTimeout(async () => {
      this.pendingRetries.delete(id);
      if (!this.paused) {
        await fn();
      }
    }, delay);

    this.pendingRetries.set(id, timerId);
    return id;
  }

  clearRetry(id: number): void {
    const timerId = this.pendingRetries.get(id);
    if (timerId) {
      clearTimeout(timerId);
      this.pendingRetries.delete(id);
    }
  }

  destroy(): void {
    this.pendingRetries.forEach((timerId) => clearTimeout(timerId));
    this.pendingRetries.clear();
  }
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private offlineQueue: OfflineQueue;
  private retryScheduler: RetryScheduler;
  private isOnline = true;
  private networkStatusCallbacks: Set<(online: boolean) => void> = new Set();

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: '',
      timeout: 10000,
      retries: 3,
      retryDelay: 300,
      retryDelayMax: 10000,
      retryFactor: 2,
      ...config
    };

    this.offlineQueue = new OfflineQueue();
    this.retryScheduler = new NetworkRetryScheduler();

    // Initialize offline queue
    this.offlineQueue.init();
  }

  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    // Notify subscribers
    this.networkStatusCallbacks.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('Error in network status callback:', error);
      }
    });

    if (online && wasOffline) {
      // Resume retry scheduler and flush offline queue
      this.retryScheduler.resume();
      this.flushOfflineQueue();
    } else if (!online) {
      // Pause retry scheduler when going offline
      this.retryScheduler.pause();
    }
  }

  subscribeToNetworkStatus(callback: (online: boolean) => void): () => void {
    this.networkStatusCallbacks.add(callback);
    return () => this.networkStatusCallbacks.delete(callback);
  }

  getNetworkDiagnostics() {
    return {
      isOnline: this.isOnline,
      queueStatus: this.getQueueStatus(),
      retrySchedulerPaused: this.retryScheduler.isPaused()
    };
  }

  async flushOfflineQueue(): Promise<void> {
    if (!this.isOnline) return;

    try {
      const processedCount = await this.offlineQueue.flush(async (operation) => {
        try {
          await this.executeRequest(operation.url, {
            method: operation.type,
            body: JSON.stringify(operation.data),
            headers: {
              'Content-Type': 'application/json',
              ...operation.headers
            },
            skipRetry: true,
            skipOfflineQueue: true
          });
          return true;
        } catch (error) {
          // Only retry if it's not a client error (4xx)
          const apiError = normalizeError(error);
          return apiError.code === 'CLIENT_ERROR' ? true : false;
        }
      });

      if (processedCount > 0) {
        console.log(`Processed ${processedCount} offline operations`);
      }
    } catch (error) {
      console.error('Error flushing offline queue:', error);
    }
  }

  private async executeRequest<T = any>(
  url: string,
  options: ApiClientOptions = {})
  : Promise<T> {
    const {
      timeout = this.config.timeout,
      skipRetry = false,
      skipOfflineQueue = false,
      idempotencyKey,
      ...fetchOptions
    } = options;

    // Resolve full URL
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
          ...fetchOptions.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status >= 400 && response.status < 500 ? 'CLIENT_ERROR' : 'SERVER_ERROR',
          response.status < 500, // Only retry server errors
          { status: response.status, statusText: response.statusText }
        );
      }

      // Try to parse JSON, fallback to text
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return (await response.text()) as T;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      // Normalize network errors
      if (isOfflineError(error)) {
        throw new ApiError(
          'Network connection error',
          'NETWORK_OFFLINE',
          true,
          { originalError: error }
        );
      }

      // Handle abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(
          'Request timeout',
          'TIMEOUT',
          true,
          { timeout }
        );
      }

      // Generic error
      throw normalizeError(error);
    }
  }

  private async requestWithRetry<T = any>(
  url: string,
  options: ApiClientOptions = {})
  : Promise<T> {
    const { skipRetry = false } = options;

    if (skipRetry || this.config.retries === 0) {
      return this.executeRequest<T>(url, options);
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        return await this.executeRequest<T>(url, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors or if we've exhausted attempts
        if (attempt === this.config.retries ||
        error instanceof ApiError && !error.retryable) {
          break;
        }

        // Wait before retry (unless we're offline and scheduler is paused)
        if (!this.retryScheduler.isPaused()) {
          const delay = calculateBackoffDelay(
            attempt,
            this.config.retryDelay,
            this.config.retryDelayMax,
            this.config.retryFactor
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  async get<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<T> {
    return this.requestWithRetry<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<T> {
    const { skipOfflineQueue = false } = options;

    // Queue write operations when offline
    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('POST', url, data, options.headers as Record<string, string>);
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true }
      );
    }

    return this.requestWithRetry<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T = any>(url: string, data?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<T> {
    const { skipOfflineQueue = false } = options;

    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('PUT', url, data, options.headers as Record<string, string>);
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true }
      );
    }

    return this.requestWithRetry<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<T> {
    const { skipOfflineQueue = false } = options;

    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('DELETE', url, undefined, options.headers as Record<string, string>);
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true }
      );
    }

    return this.requestWithRetry<T>(url, { ...options, method: 'DELETE' });
  }

  getQueueStatus() {
    return {
      size: this.offlineQueue.size(),
      isEmpty: this.offlineQueue.isEmpty(),
      operations: this.offlineQueue.getAll()
    };
  }

  async clearQueue(): Promise<void> {
    await this.offlineQueue.clear();
  }

  destroy(): void {
    if (this.retryScheduler instanceof NetworkRetryScheduler) {
      this.retryScheduler.destroy();
    }
  }
}

// Global API client instance
export const apiClient = new ApiClient({
  baseURL: '' // Will use current origin
});

// Utility function to create typed API error
export function createApiError(
message: string,
code: string = 'UNKNOWN_ERROR',
retryable: boolean = false,
details?: any)
: ApiError {
  return new ApiError(message, code, retryable, details);
}