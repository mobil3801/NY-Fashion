import { logger } from './production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';

interface PerformanceMetrics {
  componentRender: Map<string, number[]>;
  apiCalls: Map<string, { duration: number; success: boolean; timestamp: number }[]>;
  pageLoads: Array<{ page: string; duration: number; timestamp: number }>;
  memoryUsage: Array<{ used: number; total: number; timestamp: number }>;
  networkRequests: Array<{ url: string; method: string; duration: number; status: number; timestamp: number }>;
  userInteractions: Array<{ type: string; target: string; duration?: number; timestamp: number }>;
  errors: Array<{ error: string; component?: string; timestamp: number }>;
  vitals: {
    fcp?: number; // First Contentful Paint
    lcp?: number; // Largest Contentful Paint
    cls?: number; // Cumulative Layout Shift
    fid?: number; // First Input Delay
    ttfb?: number; // Time to First Byte
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    componentRender: new Map(),
    apiCalls: new Map(),
    pageLoads: [],
    memoryUsage: [],
    networkRequests: [],
    userInteractions: [],
    errors: [],
    vitals: {}
  };

  private isEnabled: boolean;
  private flushInterval: NodeJS.Timeout | null = null;
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.isEnabled = PRODUCTION_CONFIG.monitoring.enablePerformanceMetrics;
    
    if (this.isEnabled) {
      this.initialize();
    }
  }

  private initialize() {
    logger.logInfo('Initializing performance monitor');
    
    // Set up performance observers
    this.setupPerformanceObservers();
    
    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor user interactions
    this.setupUserInteractionMonitoring();
    
    // Set up periodic metrics flush
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, PRODUCTION_CONFIG.monitoring.metricsFlushInterval);
  }

  private setupPerformanceObservers() {
    try {
      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordPageLoad(window.location.pathname, navEntry.loadEventEnd - navEntry.loadEventStart);
            
            // Record vital metrics
            this.metrics.vitals.ttfb = navEntry.responseStart - navEntry.requestStart;
          }
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);

      // Paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.vitals.fcp = entry.startTime;
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformancePaintTiming;
        this.metrics.vitals.lcp = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries() as LayoutShift[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.vitals.cls = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          this.metrics.vitals.fid = entry.processingStart - entry.startTime;
          // FID is only measured once per page load
          fidObserver.disconnect();
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Resource timing for network requests
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            this.recordNetworkRequest(
              entry.name,
              'GET', // Default to GET, could be enhanced
              entry.responseEnd - entry.requestStart,
              200, // Default to success, could be enhanced
              Date.now()
            );
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

    } catch (error) {
      logger.logError('Failed to set up performance observers', error);
    }
  }

  private startMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMemoryUsage(memory.usedJSHeapSize, memory.totalJSHeapSize);
      }, 30000); // Every 30 seconds
    }
  }

  private setupUserInteractionMonitoring() {
    const interactionTypes = ['click', 'scroll', 'keydown', 'touchstart'];
    
    interactionTypes.forEach(type => {
      document.addEventListener(type, (event) => {
        this.recordUserInteraction(
          type,
          (event.target as Element)?.tagName || 'unknown'
        );
      }, { passive: true });
    });
  }

  // Public methods for recording metrics
  recordComponentRender(componentName: string, duration: number) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.componentRender.has(componentName)) {
      this.metrics.componentRender.set(componentName, []);
    }
    
    const renderTimes = this.metrics.componentRender.get(componentName)!;
    renderTimes.push(duration);
    
    // Keep only recent measurements
    if (renderTimes.length > 100) {
      renderTimes.splice(0, renderTimes.length - 100);
    }
    
    logger.logPerformance('component', componentName, duration, true, {
      averageRenderTime: this.getAverageRenderTime(componentName)
    });
  }

  recordApiCall(endpoint: string, duration: number, success: boolean) {
    if (!this.isEnabled) return;
    
    if (!this.metrics.apiCalls.has(endpoint)) {
      this.metrics.apiCalls.set(endpoint, []);
    }
    
    const apiCalls = this.metrics.apiCalls.get(endpoint)!;
    apiCalls.push({
      duration,
      success,
      timestamp: Date.now()
    });
    
    // Keep only recent measurements
    if (apiCalls.length > 100) {
      apiCalls.splice(0, apiCalls.length - 100);
    }
    
    logger.logPerformance('api', endpoint, duration, success, {
      successRate: this.getApiSuccessRate(endpoint),
      averageResponseTime: this.getAverageApiResponseTime(endpoint)
    });
  }

  recordPageLoad(page: string, duration: number) {
    if (!this.isEnabled) return;
    
    this.metrics.pageLoads.push({
      page,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only recent measurements
    if (this.metrics.pageLoads.length > 100) {
      this.metrics.pageLoads.splice(0, this.metrics.pageLoads.length - 100);
    }
    
    logger.logPerformance('page', page, duration, true, {
      vitals: this.metrics.vitals
    });
  }

  recordMemoryUsage(used: number, total: number) {
    if (!this.isEnabled) return;
    
    this.metrics.memoryUsage.push({
      used,
      total,
      timestamp: Date.now()
    });
    
    // Keep only recent measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.splice(0, this.metrics.memoryUsage.length - 100);
    }
  }

  recordNetworkRequest(url: string, method: string, duration: number, status: number, timestamp: number) {
    if (!this.isEnabled) return;
    
    this.metrics.networkRequests.push({
      url,
      method,
      duration,
      status,
      timestamp
    });
    
    // Keep only recent measurements
    if (this.metrics.networkRequests.length > 200) {
      this.metrics.networkRequests.splice(0, this.metrics.networkRequests.length - 200);
    }
  }

  recordUserInteraction(type: string, target: string, duration?: number) {
    if (!this.isEnabled) return;
    
    this.metrics.userInteractions.push({
      type,
      target,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only recent measurements
    if (this.metrics.userInteractions.length > 100) {
      this.metrics.userInteractions.splice(0, this.metrics.userInteractions.length - 100);
    }
  }

  recordError(error: string, component?: string) {
    if (!this.isEnabled) return;
    
    this.metrics.errors.push({
      error,
      component,
      timestamp: Date.now()
    });
    
    // Keep only recent measurements
    if (this.metrics.errors.length > 50) {
      this.metrics.errors.splice(0, this.metrics.errors.length - 50);
    }
    
    logger.logError('Performance error recorded', error, { component });
  }

  // Analysis methods
  getAverageRenderTime(componentName: string): number {
    const renderTimes = this.metrics.componentRender.get(componentName);
    if (!renderTimes || renderTimes.length === 0) return 0;
    
    return renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
  }

  getAverageApiResponseTime(endpoint: string): number {
    const apiCalls = this.metrics.apiCalls.get(endpoint);
    if (!apiCalls || apiCalls.length === 0) return 0;
    
    return apiCalls.reduce((sum, call) => sum + call.duration, 0) / apiCalls.length;
  }

  getApiSuccessRate(endpoint: string): number {
    const apiCalls = this.metrics.apiCalls.get(endpoint);
    if (!apiCalls || apiCalls.length === 0) return 0;
    
    const successfulCalls = apiCalls.filter(call => call.success).length;
    return (successfulCalls / apiCalls.length) * 100;
  }

  getPerformanceSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    return {
      vitals: this.metrics.vitals,
      
      // Component performance
      slowestComponents: Array.from(this.metrics.componentRender.entries())
        .map(([name, times]) => ({
          name,
          averageTime: this.getAverageRenderTime(name),
          renders: times.length
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10),
      
      // API performance
      apiEndpoints: Array.from(this.metrics.apiCalls.entries())
        .map(([endpoint, calls]) => ({
          endpoint,
          averageResponseTime: this.getAverageApiResponseTime(endpoint),
          successRate: this.getApiSuccessRate(endpoint),
          callCount: calls.length
        }))
        .sort((a, b) => b.averageResponseTime - a.averageResponseTime),
      
      // Page performance
      recentPageLoads: this.metrics.pageLoads
        .filter(load => load.timestamp > oneHourAgo)
        .sort((a, b) => b.duration - a.duration),
      
      // Memory usage
      currentMemoryUsage: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
      
      // Error summary
      recentErrors: this.metrics.errors
        .filter(error => error.timestamp > oneHourAgo)
        .length,
      
      // Network performance
      networkSummary: {
        totalRequests: this.metrics.networkRequests.length,
        averageResponseTime: this.metrics.networkRequests.length > 0 
          ? this.metrics.networkRequests.reduce((sum, req) => sum + req.duration, 0) / this.metrics.networkRequests.length
          : 0,
        errorRate: this.metrics.networkRequests.length > 0
          ? (this.metrics.networkRequests.filter(req => req.status >= 400).length / this.metrics.networkRequests.length) * 100
          : 0
      },
      
      timestamp: new Date().toISOString()
    };
  }

  private flushMetrics() {
    if (!this.isEnabled) return;
    
    const summary = this.getPerformanceSummary();
    logger.logBusinessMetric('performance_metrics_flush', 1, summary);
    
    // In production, you would send this data to your analytics service
    // For now, we'll just log it
    logger.logInfo('Performance metrics flushed', { metricsCount: Object.keys(summary).length });
  }

  // Cleanup method
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        logger.logError('Error disconnecting performance observer', error);
      }
    });
    
    this.observers = [];
    logger.logInfo('Performance monitor destroyed');
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Higher-order component for performance tracking
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name;
  
  const PerformanceTrackedComponent: React.FC<P> = (props) => {
    const startTime = performance.now();
    
    React.useEffect(() => {
      return () => {
        const duration = performance.now() - startTime;
        performanceMonitor.recordComponentRender(displayName, duration);
      };
    }, []);
    
    try {
      return React.createElement(WrappedComponent, props);
    } catch (error) {
      performanceMonitor.recordError(
        error instanceof Error ? error.message : 'Unknown error',
        displayName
      );
      throw error;
    }
  };
  
  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  return PerformanceTrackedComponent;
};

// Hook for performance tracking
export const usePerformanceTracking = (operationName: string) => {
  const startOperation = React.useCallback(() => {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        performanceMonitor.recordComponentRender(operationName, duration);
        return duration;
      }
    };
  }, [operationName]);
  
  return { startOperation };
};

export default performanceMonitor;