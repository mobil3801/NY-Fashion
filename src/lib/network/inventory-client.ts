
import { ApiClient, ApiClientOptions } from './client';
import { createApiError } from './client';
import { ApiError, normalizeError } from '../errors';
import { toast } from '@/hooks/use-toast';

export interface InventoryRequest {
  operation: string;
  url: string;
  requestId: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  lastError?: string;
  responseTime?: number;
}

export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    headers: Array<{name: string; value: string}>;
    queryString: Array<{name: string; value: string}>;
    postData?: {
      mimeType: string;
      text: string;
    };
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{name: string; value: string}>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
    bodySize: number;
  };
  cache: {};
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    send: number;
    wait: number;
    receive: number;
    ssl: number;
  };
}

export interface TokenRefreshContext {
  isRefreshing: boolean;
  refreshPromise: Promise<void> | null;
  pendingRequests: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    request: () => Promise<any>;
  }>;
}

export class InventoryNetworkClient extends ApiClient {
  private activeRequests = new Map<string, InventoryRequest>();
  private harEntries: HAREntry[] = [];
  private tokenRefreshContext: TokenRefreshContext = {
    isRefreshing: false,
    refreshPromise: null,
    pendingRequests: []
  };
  private performanceObserver?: PerformanceObserver;
  private requestIdCounter = 0;

  constructor() {
    super({
      timeout: 15000,
      retries: 3,
      retryDelay: 500,
      retryDelayMax: 10000,
      retryFactor: 2
    });

    this.initializePerformanceMonitoring();
    this.initializeHealthCheck();
  }

  private generateRequestId(): string {
    return `inv_req_${++this.requestIdCounter}_${Date.now()}`;
  }

  private initializePerformanceMonitoring(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
            this.capturePerformanceEntry(entry as any);
          }
        });
      });

      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'resource'] 
      });
    } catch (error) {
      console.warn('Performance monitoring unavailable:', error);
    }
  }

  private capturePerformanceEntry(entry: PerformanceEntry): void {
    // Only capture entries related to inventory operations
    if (!this.isInventoryRelated(entry.name)) return;

    const harEntry: Partial<HAREntry> = {
      startedDateTime: new Date(performance.timeOrigin + entry.startTime).toISOString(),
      time: entry.duration,
      request: {
        method: 'GET', // Default, would need to be captured from actual request
        url: entry.name,
        headers: [],
        queryString: [],
        bodySize: 0
      },
      response: {
        status: 200, // Default, would need actual response
        statusText: 'OK',
        headers: [],
        content: {
          size: (entry as any).transferSize || 0,
          mimeType: 'application/json'
        },
        bodySize: (entry as any).encodedBodySize || 0
      },
      cache: {},
      timings: {
        blocked: (entry as any).domainLookupStart || 0,
        dns: ((entry as any).domainLookupEnd - (entry as any).domainLookupStart) || 0,
        connect: ((entry as any).connectEnd - (entry as any).connectStart) || 0,
        send: 0,
        wait: ((entry as any).responseStart - (entry as any).requestStart) || 0,
        receive: ((entry as any).responseEnd - (entry as any).responseStart) || 0,
        ssl: ((entry as any).secureConnectionStart ? (entry as any).connectEnd - (entry as any).secureConnectionStart : 0)
      }
    };

    this.harEntries.push(harEntry as HAREntry);

    // Keep only last 50 entries to prevent memory issues
    if (this.harEntries.length > 50) {
      this.harEntries.shift();
    }
  }

  private isInventoryRelated(url: string): boolean {
    return url.includes('inventory') || 
           url.includes('product') || 
           url.includes('stock') || 
           url.includes('category') ||
           url.includes('getProducts') ||
           url.includes('saveProduct') ||
           url.includes('getCategories');
  }

  private async initializeHealthCheck(): Promise<void> {
    // Perform initial health check with enhanced diagnostics
    try {
      const healthResult = await this.performHealthCheck();
      console.log('Inventory network client initialized:', healthResult);
    } catch (error) {
      console.warn('Initial health check failed:', error);
    }
  }

  private async performHealthCheck(): Promise<{
    online: boolean;
    latency: number;
    endpoints: Array<{url: string; status: number; latency: number}>;
  }> {
    const testEndpoints = [
      `${window.location.origin}/`,
      `${window.location.origin}/favicon.ico`,
      'https://httpbin.org/status/200'
    ];

    const results: Array<{url: string; status: number; latency: number}> = [];
    let totalLatency = 0;
    let successCount = 0;

    for (const endpoint of testEndpoints) {
      try {
        const startTime = performance.now();
        const response = await fetch(endpoint, {
          method: 'HEAD',
          mode: endpoint.includes(window.location.origin) ? 'cors' : 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        
        const latency = performance.now() - startTime;
        results.push({
          url: endpoint,
          status: response.status,
          latency
        });

        if (response.ok || response.status === 0) { // no-cors returns 0
          successCount++;
          totalLatency += latency;
        }
      } catch (error) {
        results.push({
          url: endpoint,
          status: 0,
          latency: 0
        });
      }
    }

    return {
      online: successCount > 0,
      latency: successCount > 0 ? totalLatency / successCount : 0,
      endpoints: results
    };
  }

  private async handleTokenRefresh(): Promise<void> {
    if (this.tokenRefreshContext.isRefreshing) {
      return this.tokenRefreshContext.refreshPromise!;
    }

    this.tokenRefreshContext.isRefreshing = true;
    this.tokenRefreshContext.refreshPromise = this.performTokenRefresh();

    try {
      await this.tokenRefreshContext.refreshPromise;
      
      // Process all pending requests
      const pendingRequests = [...this.tokenRefreshContext.pendingRequests];
      this.tokenRefreshContext.pendingRequests = [];

      for (const pendingRequest of pendingRequests) {
        try {
          const result = await pendingRequest.request();
          pendingRequest.resolve(result);
        } catch (error) {
          pendingRequest.reject(error);
        }
      }
    } finally {
      this.tokenRefreshContext.isRefreshing = false;
      this.tokenRefreshContext.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      // In a real implementation, this would call your auth service
      // For now, we'll simulate token refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // You would typically update the token in localStorage or wherever you store it
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  private isAuthError(error: any): boolean {
    return (error?.status === 401) || 
           (error?.status === 403) ||
           (error?.code === 'UNAUTHORIZED') ||
           (error?.message?.toLowerCase().includes('unauthorized')) ||
           (error?.message?.toLowerCase().includes('forbidden'));
  }

  private async requestWithTokenGating<T = any>(
    url: string,
    options: ApiClientOptions = {}
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Create request tracking entry
    const requestEntry: InventoryRequest = {
      operation: `${options.method || 'GET'} ${url}`,
      url,
      requestId,
      timestamp: startTime,
      status: 'pending',
      attempts: 0,
      responseTime: 0
    };

    this.activeRequests.set(requestId, requestEntry);

    try {
      // If token is being refreshed, queue this request
      if (this.tokenRefreshContext.isRefreshing && !options.skipRetry) {
        return new Promise<T>((resolve, reject) => {
          this.tokenRefreshContext.pendingRequests.push({
            resolve,
            reject,
            request: () => this.request<T>(url, options)
          });
        });
      }

      let lastError: any;
      const maxAttempts = (options.retry?.attempts ?? this.config.retries) + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        requestEntry.attempts = attempt;
        requestEntry.status = attempt > 1 ? 'retrying' : 'pending';
        
        try {
          const result = await super.request<T>(url, {
            ...options,
            skipRetry: true // Handle retries ourselves
          });

          requestEntry.status = 'success';
          requestEntry.responseTime = Date.now() - startTime;
          
          return result;
        } catch (error) {
          lastError = error;
          requestEntry.lastError = error instanceof Error ? error.message : String(error);

          // Handle authentication errors with token refresh
          if (this.isAuthError(error) && !this.tokenRefreshContext.isRefreshing) {
            try {
              await this.handleTokenRefresh();
              // Retry the request after token refresh
              continue;
            } catch (refreshError) {
              // Token refresh failed, don't retry
              break;
            }
          }

          // Don't retry non-retryable errors
          if (error instanceof ApiError && !error.retryable) {
            break;
          }

          // Don't retry on final attempt
          if (attempt === maxAttempts) {
            break;
          }

          // Calculate delay and wait
          const delay = this.calculateBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      requestEntry.status = 'failed';
      requestEntry.responseTime = Date.now() - startTime;

      throw lastError;
    } finally {
      // Clean up request tracking after some time
      setTimeout(() => {
        this.activeRequests.delete(requestId);
      }, 60000); // Keep for 1 minute for debugging
    }
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay;
    const maxDelay = this.config.retryDelayMax;
    const factor = this.config.retryFactor;
    
    const exponentialDelay = baseDelay * Math.pow(factor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter (random factor between 0.5 and 1.5)
    const jitter = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitter);
  }

  // Enhanced inventory-specific methods
  async fetchProducts(searchParams?: any): Promise<any[]> {
    try {
      const result = await this.requestWithTokenGating('/api/inventory/products', {
        method: 'POST',
        body: JSON.stringify({
          path: 'getProducts',
          param: [searchParams || {}]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (result.error) {
        throw createApiError(result.error, 'INVENTORY_ERROR', true);
      }

      return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      this.logInventoryError('fetchProducts', error);
      throw this.enhanceInventoryError(error, 'fetchProducts');
    }
  }

  async fetchCategories(): Promise<any[]> {
    try {
      const result = await this.requestWithTokenGating('/api/inventory/categories', {
        method: 'POST',
        body: JSON.stringify({
          path: 'getCategories',
          param: [{}]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (result.error) {
        throw createApiError(result.error, 'INVENTORY_ERROR', true);
      }

      return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      this.logInventoryError('fetchCategories', error);
      throw this.enhanceInventoryError(error, 'fetchCategories');
    }
  }

  async saveProduct(product: any): Promise<any> {
    try {
      const result = await this.requestWithTokenGating('/api/inventory/product', {
        method: 'POST',
        body: JSON.stringify({
          path: 'saveProduct',
          param: [product, 1] // TODO: Get actual user ID
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (result.error) {
        throw createApiError(result.error, 'INVENTORY_ERROR', false); // Don't retry saves
      }

      return result.data;
    } catch (error) {
      this.logInventoryError('saveProduct', error);
      throw this.enhanceInventoryError(error, 'saveProduct');
    }
  }

  private logInventoryError(operation: string, error: any): void {
    const errorEntry = {
      operation,
      timestamp: Date.now(),
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: error.code || 'UNKNOWN',
        status: error.status,
        stack: error instanceof Error ? error.stack : undefined
      },
      networkState: {
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType,
        downlink: (navigator as any).connection?.downlink,
        rtt: (navigator as any).connection?.rtt
      }
    };

    console.error(`[InventoryNetworkClient] ${operation}:`, errorEntry);
    
    // Store error for diagnostics
    this.storeErrorDiagnostic(errorEntry);
  }

  private storeErrorDiagnostic(errorEntry: any): void {
    try {
      const diagnostics = JSON.parse(localStorage.getItem('inventory_error_diagnostics') || '[]');
      diagnostics.push(errorEntry);
      
      // Keep only last 20 errors
      if (diagnostics.length > 20) {
        diagnostics.shift();
      }
      
      localStorage.setItem('inventory_error_diagnostics', JSON.stringify(diagnostics));
    } catch (error) {
      console.warn('Failed to store error diagnostic:', error);
    }
  }

  private enhanceInventoryError(error: any, operation: string): ApiError {
    const baseError = normalizeError(error, operation);
    
    // Add inventory-specific context
    return new ApiError(
      baseError.message,
      baseError.code,
      baseError.retryable,
      {
        ...baseError.details,
        operation,
        inventorySpecific: true,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    );
  }

  // Diagnostic methods
  getActiveRequests(): InventoryRequest[] {
    return Array.from(this.activeRequests.values());
  }

  getHAREntries(): HAREntry[] {
    return [...this.harEntries];
  }

  getErrorDiagnostics(): any[] {
    try {
      return JSON.parse(localStorage.getItem('inventory_error_diagnostics') || '[]');
    } catch (error) {
      return [];
    }
  }

  clearDiagnostics(): void {
    this.harEntries = [];
    this.activeRequests.clear();
    localStorage.removeItem('inventory_error_diagnostics');
  }

  exportDiagnostics(): string {
    const diagnostics = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      networkState: {
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType,
        downlink: (navigator as any).connection?.downlink,
        rtt: (navigator as any).connection?.rtt
      },
      activeRequests: this.getActiveRequests(),
      harEntries: this.getHAREntries(),
      errorDiagnostics: this.getErrorDiagnostics()
    };

    return JSON.stringify(diagnostics, null, 2);
  }

  destroy(): void {
    this.performanceObserver?.disconnect();
    this.clearDiagnostics();
    super.destroy();
  }
}

// Global inventory client instance
export const inventoryClient = new InventoryNetworkClient();
