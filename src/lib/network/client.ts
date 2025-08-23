
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

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ApiClientOptions extends RequestInit {
  timeout?: number;
  skipRetry?: boolean;
  skipOfflineQueue?: boolean;
  idempotencyKey?: string;
  retry?: RetryOptions;
}

export interface RetryScheduler {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  retryNow(): Promise<void>;
  scheduleRetry(fn: () => Promise<void>, attempt: number): number;
  clearRetry(id: number): void;
}

interface PendingRequest {
  id: string;
  promise: Promise<any>;
  controller: AbortController;
  idempotencyKey?: string;
}

class NetworkRetryScheduler implements RetryScheduler {
  private paused = false;
  private pendingRetries = new Map<number, number>();
  private pausedRetries = new Map<number, () => Promise<void>>();
  private nextId = 1;

  pause(): void {
    this.paused = true;
    // Clear all pending retries but store them for later
    this.pendingRetries.forEach((timerId, retryId) => {
      clearTimeout(timerId);
      // Store paused retries would need the function reference, which we don't have here
      // The caller should re-schedule after resume
    });
    this.pendingRetries.clear();
  }

  resume(): void {
    this.paused = false;
    // Clear paused retries as caller should handle re-scheduling
    this.pausedRetries.clear();
  }

  isPaused(): boolean {
    return this.paused;
  }

  async retryNow(): Promise<void> {
    if (this.paused) {
      this.resume();
    }
    
    // Execute all pending retries immediately
    const retryPromises: Promise<void>[] = [];
    
    this.pendingRetries.forEach((timerId, retryId) => {
      clearTimeout(timerId);
      this.pendingRetries.delete(retryId);
    });

    this.pausedRetries.forEach((retryFn) => {
      retryPromises.push(retryFn().catch(console.error));
    });

    this.pausedRetries.clear();
    
    await Promise.allSettled(retryPromises);
  }

  scheduleRetry(fn: () => Promise<void>, attempt: number): number {
    const id = this.nextId++;

    if (this.paused) {
      this.pausedRetries.set(id, fn);
      return id;
    }

    const delay = calculateBackoffDelay(attempt);
    const timerId = window.setTimeout(async () => {
      this.pendingRetries.delete(id);
      if (!this.paused) {
        try {
          await fn();
        } catch (error) {
          console.error('Retry execution failed:', error);
        }
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
    this.pausedRetries.delete(id);
  }

  destroy(): void {
    this.pendingRetries.forEach((timerId) => clearTimeout(timerId));
    this.pendingRetries.clear();
    this.pausedRetries.clear();
  }
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private offlineQueue: OfflineQueue;
  private retryScheduler: RetryScheduler;
  private isOnline = true;
  private networkStatusCallbacks: Set<(online: boolean) => void> = new Set();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestIdCounter = 0;

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

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanup());
      window.addEventListener('unload', () => this.cleanup());
    }
  }

  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    // Notify subscribers
    this.networkStatusCallbacks.forEach((callback) => {
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

  async retryNow(): Promise<void> {
    await this.retryScheduler.retryNow();
    if (this.isOnline) {
      await this.flushOfflineQueue();
    }
  }

  getNetworkDiagnostics() {
    return {
      isOnline: this.isOnline,
      queueStatus: this.getQueueStatus(),
      retrySchedulerPaused: this.retryScheduler.isPaused(),
      pendingRequestsCount: this.pendingRequests.size
    };
  }

  private generateRequestId(): string {
    return `req_${++this.requestIdCounter}_${Date.now()}`;
  }

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch (error) {
        console.warn('crypto.randomUUID() failed, using fallback:', error);
      }
    }
    
    return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private enhancedErrorNormalization(error: unknown, operation?: string): ApiError {
    // Handle AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      return new ApiError(
        'Request was cancelled',
        'ABORT',
        false,
        { operation, originalError: error.message }
      );
    }

    // Handle TimeoutError
    if (error instanceof Error && (
      error.name === 'TimeoutError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.includes('signal timed out')
    )) {
      return new ApiError(
        'Request timed out',
        'TIMEOUT',
        true,
        { operation, originalError: error.message }
      );
    }

    // Handle TypeError and network errors (comprehensive detection)
    if (error instanceof TypeError ||
        error instanceof Error && (
          error.message.includes('fetch') ||
          error.message.includes('ERR_NETWORK') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('ERR_INTERNET_DISCONNECTED') ||
          error.message.includes('ERR_NAME_NOT_RESOLVED') ||
          error.message.includes('ERR_CONNECTION_REFUSED') ||
          error.message.includes('ERR_CONNECTION_TIMED_OUT') ||
          error.message.includes('ERR_CONNECTION_RESET') ||
          error.message.includes('net::') ||
          error.name === 'NetworkError'
        )) {
      
      const message = error instanceof Error ? error.message : String(error);
      
      // Classify specific network error types
      if (message.includes('ERR_NAME_NOT_RESOLVED') || message.includes('ENOTFOUND')) {
        return new ApiError(
          'DNS resolution failed',
          'DNS_ERROR',
          true,
          { operation, originalError: message, errorType: 'dns' }
        );
      }
      
      if (message.includes('ERR_CONNECTION_REFUSED') || message.includes('ECONNREFUSED')) {
        return new ApiError(
          'Connection refused by server',
          'CONNECTION_REFUSED',
          true,
          { operation, originalError: message, errorType: 'connection' }
        );
      }
      
      if (message.includes('ERR_CONNECTION_RESET') || message.includes('ECONNRESET')) {
        return new ApiError(
          'Connection reset by server',
          'CONNECTION_RESET',
          true,
          { operation, originalError: message, errorType: 'connection' }
        );
      }
      
      return new ApiError(
        'Network connection issue',
        'NETWORK_OFFLINE',
        true,
        { operation, originalError: message, errorType: 'network' }
      );
    }

    // Handle Response-like objects (fetch errors) with enhanced status code handling
    if (error && typeof error === 'object' && 'status' in error) {
      const response = error as any;
      const statusCode = response.status;
      
      // More granular status code handling
      let code: string;
      let retryable: boolean;
      
      if (statusCode >= 400 && statusCode < 500) {
        // Client errors
        code = 'CLIENT_ERROR';
        retryable = statusCode === 408 || statusCode === 429; // Timeout and Rate Limit
      } else if (statusCode >= 500) {
        // Server errors
        code = 'SERVER_ERROR';
        retryable = true;
      } else {
        code = 'HTTP_ERROR';
        retryable = false;
      }

      return new ApiError(
        `HTTP ${statusCode}: ${response.statusText || 'Unknown error'}`,
        code,
        retryable,
        { 
          operation, 
          statusCode, 
          statusText: response.statusText,
          responseBody: response.body 
        }
      );
    }

    // Fall back to the existing normalization
    return normalizeError(error, operation);
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
          const apiError = this.enhancedErrorNormalization(error);
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
    options: ApiClientOptions = {}
  ): Promise<T> {
    const {
      timeout = this.config.timeout,
      skipRetry = false,
      skipOfflineQueue = false,
      idempotencyKey,
      ...fetchOptions
    } = options;

    // Resolve full URL
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;

    // Setup timeout with enhanced AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Handle external signal
    if (fetchOptions.signal) {
      fetchOptions.signal.addEventListener('abort', () => controller.abort());
    }

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
          response.status >= 500 || response.status === 408 || response.status === 429,
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

      // Use enhanced error normalization
      const normalizedError = this.enhancedErrorNormalization(error, url);
      
      // Update network status when we detect offline
      if (normalizedError.code === 'NETWORK_OFFLINE' || 
          normalizedError.code === 'DNS_ERROR' ||
          normalizedError.code === 'CONNECTION_REFUSED') {
        this.setOnlineStatus(false);
      }

      throw normalizedError;
    }
  }

  private async requestWithRetry<T = any>(
    url: string,
    options: ApiClientOptions = {}
  ): Promise<T> {
    const { 
      skipRetry = false, 
      retry = {},
      ...requestOptions 
    } = options;

    // Use custom retry options or fall back to config defaults
    const retryOptions = {
      attempts: retry.attempts ?? this.config.retries,
      baseDelayMs: retry.baseDelayMs ?? this.config.retryDelay,
      maxDelayMs: retry.maxDelayMs ?? this.config.retryDelayMax
    };

    if (skipRetry || retryOptions.attempts === 0) {
      return this.executeRequest<T>(url, requestOptions);
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= retryOptions.attempts; attempt++) {
      try {
        return await this.executeRequest<T>(url, requestOptions);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors or if we've exhausted attempts
        if (attempt === retryOptions.attempts ||
            error instanceof ApiError && !error.retryable) {
          break;
        }

        // Wait before retry with full jitter backoff
        const delay = calculateBackoffDelay(
          attempt + 1,
          retryOptions.baseDelayMs,
          retryOptions.maxDelayMs,
          this.config.retryFactor
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  async request<T = any>(
    path: string, 
    init: ApiClientOptions = {}
  ): Promise<T> {
    const { 
      idempotencyKey = this.generateIdempotencyKey(),
      signal,
      ...options 
    } = init;

    // Check for duplicate requests using idempotency key
    const existingRequest = this.pendingRequests.get(idempotencyKey);
    if (existingRequest && !existingRequest.controller.signal.aborted) {
      return existingRequest.promise;
    }

    // Create new request controller
    const requestController = new AbortController();
    const requestId = this.generateRequestId();

    // Handle external signal
    if (signal) {
      signal.addEventListener('abort', () => requestController.abort());
    }

    // Create the request promise
    const requestPromise = this.requestWithRetry<T>(path, {
      ...options,
      idempotencyKey,
      signal: requestController.signal
    }).finally(() => {
      // Clean up completed request
      this.pendingRequests.delete(idempotencyKey);
    });

    // Store pending request for deduplication
    this.pendingRequests.set(idempotencyKey, {
      id: requestId,
      promise: requestPromise,
      controller: requestController,
      idempotencyKey
    });

    return requestPromise;
  }

  async get<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<T> {
    const { skipOfflineQueue = false, idempotencyKey = this.generateIdempotencyKey() } = options;

    // Queue write operations when offline
    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('POST', url, data, {
        ...options.headers as Record<string, string>,
        'Idempotency-Key': idempotencyKey
      });
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true, idempotencyKey }
      );
    }

    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      idempotencyKey
    });
  }

  async put<T = any>(url: string, data?: any, options: Omit<ApiClientOptions, 'method' | 'body'> = {}): Promise<T> {
    const { skipOfflineQueue = false, idempotencyKey = this.generateIdempotencyKey() } = options;

    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('PUT', url, data, {
        ...options.headers as Record<string, string>,
        'Idempotency-Key': idempotencyKey
      });
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true, idempotencyKey }
      );
    }

    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      idempotencyKey
    });
  }

  async delete<T = any>(url: string, options: Omit<ApiClientOptions, 'method'> = {}): Promise<T> {
    const { skipOfflineQueue = false, idempotencyKey = this.generateIdempotencyKey() } = options;

    if (!this.isOnline && !skipOfflineQueue) {
      await this.offlineQueue.enqueue('DELETE', url, undefined, {
        ...options.headers as Record<string, string>,
        'Idempotency-Key': idempotencyKey
      });
      throw new ApiError(
        'Saved offline - will sync when online',
        'QUEUED_OFFLINE',
        false,
        { queued: true, idempotencyKey }
      );
    }

    return this.request<T>(url, { ...options, method: 'DELETE' });
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

  cancelAllRequests(): void {
    this.pendingRequests.forEach((request) => {
      if (!request.controller.signal.aborted) {
        request.controller.abort();
      }
    });
    this.pendingRequests.clear();
  }

  cancelRequest(idempotencyKey: string): boolean {
    const request = this.pendingRequests.get(idempotencyKey);
    if (request && !request.controller.signal.aborted) {
      request.controller.abort();
      this.pendingRequests.delete(idempotencyKey);
      return true;
    }
    return false;
  }

  cleanup(): void {
    this.cancelAllRequests();
    if (this.retryScheduler instanceof NetworkRetryScheduler) {
      this.retryScheduler.destroy();
    }
  }

  destroy(): void {
    this.cleanup();
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
  details?: any
): ApiError {
  return new ApiError(message, code, retryable, details);
}
