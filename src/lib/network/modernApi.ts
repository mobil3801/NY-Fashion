/**
 * Modern API utilities that use pagehide + visibilitychange for data persistence
 * Replaces any unload-based patterns with BFCache-compatible alternatives
 */

export interface ApiRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  persistenceKey?: string; // For auto-persisting failed requests
}

export interface PersistedRequest {
  id: string;
  timestamp: number;
  options: ApiRequestOptions;
  attempts: number;
  lastError?: string;
}

export class ModernApiClient {
  private pendingRequests = new Map<string, PersistedRequest>();
  private persistenceKey = 'ny-fashion-api-queue';

  constructor() {
    this.initializeLifecycleHandlers();
    this.loadPersistedRequests();
  }

  private initializeLifecycleHandlers() {
    // Use pagehide for reliable cleanup - no unload handlers
    window.addEventListener('pagehide', () => {
      this.persistPendingRequests();
    }, { capture: true });

    // Use visibilitychange as secondary handler
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.persistPendingRequests();
      }
    });

    // Handle page restoration from BFCache
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Page was restored from BFCache - retry any pending requests
        this.retryPersistedRequests();
      }
    });
  }

  private persistPendingRequests() {
    if (this.pendingRequests.size === 0) return;

    const requests = Array.from(this.pendingRequests.values());
    const data = JSON.stringify({
      timestamp: Date.now(),
      requests
    });

    // Use sendBeacon for reliable data transmission
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(`${window.location.origin}/api/queue/persist`, blob);
    }

    // Also store locally as fallback
    try {
      localStorage.setItem(this.persistenceKey, data);
    } catch (error) {
      console.warn('Failed to persist requests to localStorage:', error);
    }
  }

  private loadPersistedRequests() {
    try {
      const stored = localStorage.getItem(this.persistenceKey);
      if (stored) {
        const { requests, timestamp } = JSON.parse(stored);

        // Only restore requests that are less than 1 hour old
        if (Date.now() - timestamp < 3600000) {
          requests.forEach((request: PersistedRequest) => {
            this.pendingRequests.set(request.id, request);
          });
        }

        // Clean up storage
        localStorage.removeItem(this.persistenceKey);
      }
    } catch (error) {
      console.warn('Failed to load persisted requests:', error);
    }
  }

  private async retryPersistedRequests() {
    const requests = Array.from(this.pendingRequests.values());

    for (const request of requests) {
      if (request.attempts < 3) {// Max 3 attempts
        try {
          await this.makeRequest(request.options);
          this.pendingRequests.delete(request.id);
        } catch (error) {
          request.attempts++;
          request.lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
    }
  }

  async makeRequest(options: ApiRequestOptions): Promise<any> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add to pending requests if persistence is enabled
    if (options.persistenceKey) {
      this.pendingRequests.set(requestId, {
        id: requestId,
        timestamp: Date.now(),
        options,
        attempts: 0
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = options.timeout ?
      setTimeout(() => controller.abort(), options.timeout) :
      null;

      const response = await fetch(options.url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Remove from pending requests on success
      this.pendingRequests.delete(requestId);

      return result;
    } catch (error) {
      if (options.persistenceKey) {
        // Update the pending request with error info
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          pending.attempts++;
          pending.lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      throw error;
    }
  }

  // Modern data flushing without unload handlers
  async flushData(url: string, data: any): Promise<boolean> {
    const payload = JSON.stringify(data);

    // Try sendBeacon first (most reliable)
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        return true;
      }
    }

    // Fallback to fetch with keepalive
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });
      return response.ok;
    } catch (error) {
      console.warn('Failed to flush data:', error);
      return false;
    }
  }

  getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  clearPendingRequests(): void {
    this.pendingRequests.clear();
    localStorage.removeItem(this.persistenceKey);
  }
}

// Singleton instance
export const modernApiClient = new ModernApiClient();

// Utility function for one-off requests
export async function apiRequest(options: ApiRequestOptions): Promise<any> {
  return modernApiClient.makeRequest(options);
}

// Utility function for reliable data flushing
export async function flushApiData(url: string, data: any): Promise<boolean> {
  return modernApiClient.flushData(url, data);
}

export default modernApiClient;