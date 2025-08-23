
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
}

const DEFAULT_CONFIG: ConnectivityConfig = {
  heartbeatInterval: 25000, // 25s
  heartbeatTimeout: 5000, // 5s
  maxRetries: 5,
  baseDelay: 300,
  maxDelay: 10000,
  backoffFactor: 2
};

export type ConnectivityListener = (status: NetStatus) => void;

export class ConnectivityMonitor {
  private config: ConnectivityConfig;
  private status: NetStatus;
  private listeners: Set<ConnectivityListener> = new Set();
  private heartbeatTimer?: number;
  private abortController?: AbortController;
  private isDestroyed = false;
  private lastSuccessfulEndpoint?: string;
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
      consecutiveFailures: 0
    };

    this.setupBrowserListeners();
    this.startHeartbeat();
  }

  private setupBrowserListeners(): void {
    const handleOnline = () => {
      if (this.isDestroyed) return;
      this.updateStatus({ online: true, consecutiveFailures: 0 });
      this.performHeartbeat(); // Immediate check when online
    };

    const handleOffline = () => {
      if (this.isDestroyed) return;
      this.updateStatus({
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
      // Use actual API endpoints - try EasySite built-in endpoints first, then fallbacks
      const endpoints = [
        `${window.location.origin}/favicon.ico`, // Static resource (most reliable for EasySite)
        `${window.location.origin}/`, // Home page
        'https://httpbin.org/status/200', // Reliable external fallback
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
            method: 'HEAD',
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
        this.updateStatus({
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
    const failures = this.status.consecutiveFailures + 1;
    const shouldMarkOffline = failures >= 2; // Mark offline after 2 consecutive failures

    this.updateStatus({
      online: shouldMarkOffline ? false : this.status.online,
      consecutiveFailures: failures,
      lastError: error
    });
  }

  private updateStatus(updates: Partial<NetStatus>): void {
    if (this.isDestroyed) return;

    const previousOnline = this.status.online;
    this.status = {
      ...this.status,
      ...updates,
      lastCheck: new Date()
    };

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
    return { ...this.status };
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
    return { ...this.diagnostics, lastSuccessfulEndpoint: this.lastSuccessfulEndpoint };
  }

  public destroy(): void {
    this.isDestroyed = true;

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.abortController?.abort();
    this.abortController = undefined;
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

// Exponential backoff with jitter
export function calculateBackoffDelay(
attempt: number,
baseDelay: number = 300,
maxDelay: number = 10000,
factor: number = 2)
: number {
  const exponentialDelay = baseDelay * Math.pow(factor, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (±25% randomization)
  const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);

  return Math.max(0, cappedDelay + jitter);
}