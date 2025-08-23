
/**
 * Production-optimized connectivity client
 * Simplified version without complex dependencies that could cause bundling issues
 */

import { logger } from '@/utils/production-logger';

export interface ProductionConnectivity {
  checkConnection: () => Promise<boolean>;
  isOnline: () => boolean;
  getLatency: () => number;
}

class ProductionConnectivityManager implements ProductionConnectivity {
  private cachedLatency: number = 0;
  private lastConnectionCheck: number = 0;
  private isConnectedCache: boolean = true;

  async checkConnection(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if recent (within 30 seconds)
    if (now - this.lastConnectionCheck < 30000) {
      return this.isConnectedCache;
    }

    try {
      const startTime = performance.now();

      // Use a simple fetch to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(window.location.origin + '/sw.js', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      this.cachedLatency = performance.now() - startTime;
      this.isConnectedCache = response.ok;
      this.lastConnectionCheck = now;

      return this.isConnectedCache;
    } catch (error) {
      this.isConnectedCache = false;
      this.lastConnectionCheck = now;
      logger.logWarn('Connection check failed', { error: (error as Error).message });
      return false;
    }
  }

  isOnline(): boolean {
    return navigator.onLine && this.isConnectedCache;
  }

  getLatency(): number {
    return this.cachedLatency;
  }
}

// Export singleton instance for production use
export const productionConnectivity = new ProductionConnectivityManager();

// Export factory function for backwards compatibility
export const createProductionConnectivity = (): ProductionConnectivity => {
  return productionConnectivity;
};

export default productionConnectivity;