
export interface NetStatus {
  online: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
}

export interface ConnectivityConfig {
  heartbeatInterval: number; // ms
  heartbeatTimeout: number; // ms
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  backoffFactor: number;
  debounceMs: number; // ms to debounce status changes
}

const DEFAULT_CONFIG: ConnectivityConfig = {
  heartbeatInterval: 20000, // 20s
  heartbeatTimeout: 3000, // 3s
  maxRetries: 5,
  baseDelay: 300,
  maxDelay: 10000,
  backoffFactor: 2,
  debounceMs: 1500 // 1.5s debounce to prevent flapping
};

export type ConnectivityListener = (status: NetStatus) => void;

class ConnectivityMonitor {
  private config: ConnectivityConfig;
  private status: NetStatus;
  private listeners: Set<ConnectivityListener> = new Set();
  private heartbeatTimer?: number;
  private abortController?: AbortController;
  private isDestroyed = false;
  private lastSuccessfulEndpoint?: string;
  private debounceTimer?: number;
  private pendingStatusUpdate?: NetStatus;
  private diagnostics: {
    totalAttempts: number;
    successfulAttempts: number;
    failedEndpoints: Map<string, number>;
    averageLatency: number;
    lastLatencies: number[];
  } = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedEndpoints: new Map(),
    averageLatency: 0,
    lastLatencies: []
  };

  constructor(config: Partial<ConnectivityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.status = {
      online: navigator.onLine,
      lastCheck: new Date(),
      consecutiveFailures: 0 // Ensure this is always initialized
    };

    this.setupBrowserListeners();
  }

  private setupBrowserListeners(): void {
    const handleOnline = () => {
      if (this.isDestroyed) return;
      this.debouncedUpdateStatus({ online: true, consecutiveFailures: 0 });
      this.performHeartbeat(); // Immediate check when online
    };

    const handleOffline = () => {
      if (this.isDestroyed) return;
      this.debouncedUpdateStatus({
        online: false,
        lastError: 'Browser offline event'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Store cleanup functions
    this.cleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  private cleanup?: () => void;

  public start(): void {
    if (this.isDestroyed) return;
    this.startHeartbeat();
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.abortController?.abort();
    this.abortController = undefined;
  }

  private startHeartbeat(): void {
    if (this.isDestroyed) return;

    this.heartbeatTimer = window.setTimeout(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private async performHeartbeat(): Promise<void> {
    if (this.isDestroyed) return;

    this.abortController?.abort();
    this.abortController = new AbortController();

    const startTime = performance.now();
    this.diagnostics.totalAttempts++;

    try {
      // Health check endpoint with fallbacks - use EasySite compatible endpoints
      const endpoints = [
      `${window.location.origin}/`, // EasySite home page (most reliable)
      `${window.location.origin}/favicon.ico`, // Static resource fallback
      '/api/health', // If available
      'https://httpbin.org/status/200', // External fallback
      'https://www.google.com/favicon.ico' // Ultimate fallback
      ];

      let success = false;
      let lastError = '';
      let successfulEndpoint = '';

      for (const endpoint of endpoints) {
        try {
          const requestStart = performance.now();

          // Create a timeout promise for better control
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Heartbeat timeout')), this.config.heartbeatTimeout);
          });

          const fetchPromise = fetch(endpoint, {
            method: endpoint.endsWith('/v1/health') ? 'GET' : 'HEAD',
            mode: endpoint.includes(window.location.origin) ? 'cors' : 'no-cors',
            cache: 'no-cache',
            signal: this.abortController.signal
          });

          const response = await Promise.race([fetchPromise, timeoutPromise]);

          const latency = performance.now() - requestStart;

          // Consider any non-network error as success for connectivity
          success = true;
          successfulEndpoint = endpoint;
          this.lastSuccessfulEndpoint = endpoint;

          // Update latency tracking
          this.diagnostics.lastLatencies.push(latency);
          if (this.diagnostics.lastLatencies.length > 10) {
            this.diagnostics.lastLatencies.shift();
          }
          this.diagnostics.averageLatency = this.diagnostics.lastLatencies.reduce((a, b) => a + b, 0) / this.diagnostics.lastLatencies.length;

          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          this.diagnostics.failedEndpoints.set(endpoint, (this.diagnostics.failedEndpoints.get(endpoint) || 0) + 1);
          // Continue to next endpoint
        }
      }

      if (success) {
        this.diagnostics.successfulAttempts++;
        this.debouncedUpdateStatus({
          online: true,
          consecutiveFailures: 0,
          lastError: undefined
        });
      } else {
        this.handleHeartbeatFailure(lastError);
      }
    } catch (error) {
      if (this.isDestroyed) return;

      const errorMessage = error instanceof Error ? error.message : 'Network error';
      this.handleHeartbeatFailure(errorMessage);
    }

    // Schedule next heartbeat
    this.startHeartbeat();
  }

  private handleHeartbeatFailure(error: string): void {
    const failures = (this.status.consecutiveFailures || 0) + 1;
    const shouldMarkOffline = failures >= 2; // Mark offline after 2 consecutive failures

    this.debouncedUpdateStatus({
      online: shouldMarkOffline ? false : this.status.online,
      consecutiveFailures: failures,
      lastError: error
    });
  }

  private debouncedUpdateStatus(updates: Partial<NetStatus>): void {
    if (this.isDestroyed) return;

    // Store the pending update - ensure consecutiveFailures is always defined
    this.pendingStatusUpdate = {
      online: this.status.online,
      lastCheck: new Date(),
      consecutiveFailures: this.status.consecutiveFailures || 0,
      lastError: this.status.lastError,
      ...updates
    };

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set up new debounce timer
    this.debounceTimer = window.setTimeout(() => {
      this.applyStatusUpdate();
    }, this.config.debounceMs);
  }

  private applyStatusUpdate(): void {
    if (this.isDestroyed || !this.pendingStatusUpdate) return;

    const previousOnline = this.status.online;
    this.status = { ...this.pendingStatusUpdate };
    this.pendingStatusUpdate = undefined;

    // Only notify listeners if online status actually changed
    if (previousOnline !== this.status.online) {
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });
  }

  public getStatus(): NetStatus {
    // Ensure consecutiveFailures is always defined in returned status
    return {
      ...this.status,
      consecutiveFailures: this.status.consecutiveFailures || 0
    };
  }

  public addListener(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async checkNow(): Promise<NetStatus> {
    await this.performHeartbeat();
    return this.getStatus();
  }

  public getDiagnostics() {
    return {
      connectivity: {
        ...this.diagnostics,
        lastSuccessfulEndpoint: this.lastSuccessfulEndpoint
      }
    };
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.cleanup?.();
    this.listeners.clear();
  }
}

// Utility function to check if an error indicates offline status
export function isOfflineError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network errors (DNS, connection refused, etc.)
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('dns'));

  }

  // Check for specific HTTP status codes that indicate offline
  if (typeof error === 'object' && error !== null) {
    const status = (error as any).status || (error as any).statusCode;
    return status === 408 || status === 429 || status >= 500 && status < 600;
  }

  return false;
}

// Exponential backoff with full jitter
export function calculateBackoffDelay(
attempt: number,
baseDelay: number = 300,
maxDelay: number = 10000,
factor: number = 2)
: number {
  // Full jitter exponential backoff: delay = Math.min(maxDelay, base * 2^(attempt-1))
  const exponentialDelay = baseDelay * Math.pow(factor, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Full jitter: random value between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}

// Main factory function that returns the exact interface requested
export function createConnectivity(config?: Partial<ConnectivityConfig>) {
  const monitor = new ConnectivityMonitor(config);

  return {
    subscribe: (listener: ConnectivityListener) => monitor.addListener(listener),
    get: () => monitor.getStatus(),
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    pingNow: () => monitor.checkNow(),
    getDiagnostics: () => monitor.getDiagnostics()
  };
}