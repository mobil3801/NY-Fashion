import { offlineQueue } from '@/lib/offlineQueue';
import { logger } from '@/utils/production-logger';

export interface ConnectivityConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  endpoints: string[];
}

const DEFAULT_CONFIG: ConnectivityConfig = {
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  endpoints: [
  '/api/health',
  '/api/healthCheck',
  '/healthCheck']

};

export class Connectivity {
  private config: ConnectivityConfig;
  private isOnline = true;
  private lastCheckTime = 0;
  private checkInterval: number | null = null;

  constructor(config: Partial<ConnectivityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkConnection(): Promise<boolean> {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastCheckTime < 1000) {
      return this.isOnline;
    }

    this.lastCheckTime = now;

    // Check browser online status first
    if (!navigator.onLine) {
      this.isOnline = false;
      return false;
    }

    try {
      // Try to make a simple request to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      for (const endpoint of this.config.endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache',
            mode: 'same-origin'
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            this.isOnline = true;
            return true;
          }
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }

      // If all endpoints failed, try a simple request
      try {
        const response = await fetch('/', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        this.isOnline = response.ok;
        return this.isOnline;
      } catch (fallbackError) {
        this.isOnline = false;
        return false;
      }

    } catch (error) {
      logger.logWarn('Connection check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      this.isOnline = false;
      return false;
    }
  }

  async processQueue(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('No network connection available');
    }

    try {
      await offlineQueue.flush(async (operation) => {
        try {
          const response = await fetch(operation.url, {
            method: operation.type,
            headers: {
              'Content-Type': 'application/json',
              ...operation.headers
            },
            body: operation.data ? JSON.stringify(operation.data) : undefined
          });

          return response.ok;
        } catch (error) {
          logger.logWarn('Queue operation failed', {
            operation: operation.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return false;
        }
      });
    } catch (error) {
      logger.logError('Queue processing failed', error);
      throw error;
    }
  }

  async getQueueSize(): Promise<number> {
    try {
      return await offlineQueue.size();
    } catch (error) {
      logger.logWarn('Failed to get queue size', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  startMonitoring(interval = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkConnection().catch((error) => {
        logger.logWarn('Connectivity monitoring error', { error: error instanceof Error ? error.message : 'Unknown error' });
      });
    }, interval);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  isConnected(): boolean {
    return this.isOnline;
  }
}

export function createConnectivity(config?: Partial<ConnectivityConfig>): Connectivity {
  return new Connectivity(config);
}

// Backoff delay calculation utility function
export default function calculateBackoffDelay(
attempt: number,
baseDelayMs: number = 300,
maxDelayMs: number = 10000,
factor: number = 2)
: number {
  // Exponential backoff with full jitter
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(factor, attempt), maxDelayMs);
  // Add full jitter (0 to exponentialDelay)
  const jitter = Math.random() * exponentialDelay;
  return Math.floor(jitter);
}