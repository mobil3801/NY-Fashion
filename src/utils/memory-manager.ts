
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';

interface MemoryManager {
  cleanup(): void;
  track(key: string, cleanup: () => void): void;
  untrack(key: string): void;
  getMemoryUsage(): MemoryInfo | null;
  startMonitoring(): void;
  stopMonitoring(): void;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
}

interface CleanupTask {
  key: string;
  cleanup: () => void;
  timestamp: number;
}

class ProductionMemoryManager implements MemoryManager {
  private cleanupTasks: Map<string, CleanupTask> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;
  private memoryThreshold = 0.8; // 80% of heap limit
  private checkInterval = 30000; // 30 seconds

  constructor() {
    this.setupPageLifecycleHandlers();

    if (PRODUCTION_CONFIG.enableMemoryMonitoring) {
      this.startMonitoring();
    }
  }

  private setupPageLifecycleHandlers(): void {
    if (typeof window !== 'undefined') {
      // Clean up when page is hidden (user switches tabs, etc.)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.performLightCleanup();
        }
      });

      // Clean up before page unload
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });

      // Clean up when page becomes inactive (mobile browsers)
      window.addEventListener('pagehide', () => {
        this.cleanup();
      });

      // Handle memory pressure events (if available)
      if ('memory' in navigator) {
        (navigator as any).memory?.addEventListener?.('memorywarning', () => {
          logger.logWarn('Memory warning received');
          this.performAggressiveCleanup();
        });
      }
    }
  }

  track(key: string, cleanup: () => void): void {
    this.cleanupTasks.set(key, {
      key,
      cleanup,
      timestamp: Date.now()
    });

    logger.logDebug('Memory cleanup task tracked', { key });
  }

  untrack(key: string): void {
    const removed = this.cleanupTasks.delete(key);
    if (removed) {
      logger.logDebug('Memory cleanup task untracked', { key });
    }
  }

  cleanup(): void {
    logger.logInfo('Starting memory cleanup', {
      taskCount: this.cleanupTasks.size
    });

    const errors: string[] = [];

    // Execute all cleanup tasks
    for (const [key, task] of this.cleanupTasks) {
      try {
        task.cleanup();
        logger.logDebug('Cleanup task executed', { key });
      } catch (error) {
        const errorMsg = `Cleanup failed for ${key}: ${error}`;
        errors.push(errorMsg);
        logger.logError(errorMsg);
      }
    }

    // Clear the tasks map
    this.cleanupTasks.clear();

    // Browser-specific cleanup
    this.performBrowserCleanup();

    // Force garbage collection if available (development only)
    if (PRODUCTION_CONFIG.enableGCHints && typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc();
        logger.logDebug('Manual garbage collection triggered');
      } catch (error) {
        logger.logWarn('Manual garbage collection failed', error);
      }
    }

    logger.logInfo('Memory cleanup completed', {
      totalTasks: this.cleanupTasks.size + errors.length,
      errors: errors.length
    });
  }

  private performLightCleanup(): void {
    // Clean up old tasks (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const oldTasks = Array.from(this.cleanupTasks.entries()).
    filter(([_, task]) => task.timestamp < fiveMinutesAgo);

    for (const [key, task] of oldTasks) {
      try {
        task.cleanup();
        this.cleanupTasks.delete(key);
      } catch (error) {
        logger.logWarn(`Light cleanup failed for ${key}`, error);
      }
    }

    this.performBrowserCleanup();
  }

  private performAggressiveCleanup(): void {
    logger.logWarn('Performing aggressive memory cleanup');

    // Execute all cleanup tasks immediately
    this.cleanup();

    // Additional aggressive cleanup measures
    if (typeof window !== 'undefined') {
      // Clear any large caches
      try {
        // Clear image caches
        const images = document.querySelectorAll('img');
        images.forEach((img) => {
          if (!img.getBoundingClientRect().height) {
            img.src = '';
          }
        });

        // Clear canvas contexts
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        });

      } catch (error) {
        logger.logError('Aggressive cleanup failed', error);
      }
    }
  }

  private performBrowserCleanup(): void {
    if (typeof window !== 'undefined') {
      // Clear console in production (if enabled)
      if (PRODUCTION_CONFIG.clearConsoleOnCleanup && console.clear) {
        console.clear();
      }

      // Clear any temporary URLs
      if (window.URL && window.URL.revokeObjectURL) {










        // URLs are tracked separately by the browser, but we can encourage cleanup
        // This would require tracking blob URLs separately in the application
      }}}getMemoryUsage(): MemoryInfo | null {if (typeof performance !== 'undefined' && (performance as any).memory) {const memory = (performance as any).memory;return { usedJSHeapSize: memory.usedJSHeapSize, totalJSHeapSize: memory.totalJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100
      };
    }
    return null;
  }

  startMonitoring(): void {
    if (this.isMonitoring || typeof performance === 'undefined') return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);

    logger.logInfo('Memory monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    logger.logInfo('Memory monitoring stopped');
  }

  private checkMemoryUsage(): void {
    const memoryInfo = this.getMemoryUsage();
    if (!memoryInfo) return;

    const memoryPercentage = memoryInfo.percentage / 100;

    logger.logDebug('Memory usage check', {
      used: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024) + 'MB',
      percentage: Math.round(memoryPercentage * 100) + '%'
    });

    // Trigger cleanup at different thresholds
    if (memoryPercentage > 0.9) {
      logger.logError('Critical memory usage detected', { percentage: Math.round(memoryPercentage * 100) });
      this.performAggressiveCleanup();
    } else if (memoryPercentage > this.memoryThreshold) {
      logger.logWarn('High memory usage detected', { percentage: Math.round(memoryPercentage * 100) });
      this.performLightCleanup();
    }
  }
}

// Global memory manager instance
export const memoryManager = new ProductionMemoryManager();

// React hook for memory management
import React from 'react';

export const useMemoryManagement = (cleanupKey?: string) => {
  const cleanupRef = React.useRef<(() => void)[]>([]);
  const [memoryInfo, setMemoryInfo] = React.useState<MemoryInfo | null>(null);

  // Register cleanup function
  const addCleanup = React.useCallback((cleanup: () => void) => {
    cleanupRef.current.push(cleanup);
  }, []);

  // Component unmount cleanup
  React.useEffect(() => {
    const key = cleanupKey || `component_${Date.now()}_${Math.random()}`;

    memoryManager.track(key, () => {
      cleanupRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.error('Component cleanup failed:', error);
        }
      });
    });

    return () => {
      memoryManager.untrack(key);
    };
  }, [cleanupKey]);

  // Memory info updater
  React.useEffect(() => {
    const updateMemoryInfo = () => {
      setMemoryInfo(memoryManager.getMemoryUsage());
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    addCleanup,
    memoryInfo,
    forceCleanup: () => memoryManager.cleanup(),
    isMonitoring: memoryManager['isMonitoring']
  };
};

// HOC for automatic memory management
export const withMemoryManagement = <P extends object,>(
Component: React.ComponentType<P>,
cleanupKey?: string)
: React.ComponentType<P> => {
  return React.memo((props: P) => {
    const { addCleanup } = useMemoryManagement(cleanupKey);

    return React.createElement(Component, props);
  });
};

// Utility functions for specific cleanup scenarios
export const cleanupIntervals = (intervals: NodeJS.Timeout[]) => {
  intervals.forEach((interval) => clearInterval(interval));
};

export const cleanupTimeouts = (timeouts: NodeJS.Timeout[]) => {
  timeouts.forEach((timeout) => clearTimeout(timeout));
};

export const cleanupEventListeners = (listeners: Array<{element: EventTarget;event: string;handler: EventListener;}>) => {
  listeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
};

export const cleanupObservers = (observers: Array<{observer: MutationObserver | IntersectionObserver | ResizeObserver;disconnect: boolean;}>) => {
  observers.forEach(({ observer }) => {
    observer.disconnect();
  });
};

export const cleanupAbortControllers = (controllers: AbortController[]) => {
  controllers.forEach((controller) => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  });
};

export default memoryManager;