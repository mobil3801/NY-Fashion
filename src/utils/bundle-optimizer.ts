
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import React from 'react';

interface BundleMetrics {
  totalSize: number;
  gzippedSize: number;
  chunkCount: number;
  loadTime: number;
  cacheHitRate: number;
  compressionRatio: number;
}

interface LazyLoadConfig {
  rootMargin: string;
  threshold: number;
  preloadDistance: number;
}

class BundleOptimizer {
  private loadedChunks = new Set<string>();
  private preloadedChunks = new Set<string>();
  private metrics: BundleMetrics = {
    totalSize: 0,
    gzippedSize: 0,
    chunkCount: 0,
    loadTime: 0,
    cacheHitRate: 0,
    compressionRatio: 0
  };

  private lazyLoadConfig: LazyLoadConfig = {
    rootMargin: '100px',
    threshold: 0.1,
    preloadDistance: 2000
  };

  constructor() {
    this.initializeMetrics();
    this.setupPerformanceObserver();
    this.optimizeResourceLoading();
  }

  private initializeMetrics(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        this.metrics.loadTime = navigationEntry.loadEventEnd - navigationEntry.loadEventStart;
      }
    }
  }

  private setupPerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              this.trackResourceLoad(entry as PerformanceResourceTiming);
            }
          }
        });

        observer.observe({ entryTypes: ['resource'] });
      } catch (error) {
        logger.logWarn('Failed to setup bundle performance observer', error);
      }
    }
  }

  private trackResourceLoad(entry: PerformanceResourceTiming): void {
    if (entry.name.includes('.js') || entry.name.includes('.css')) {
      this.metrics.totalSize += entry.transferSize || 0;
      this.metrics.chunkCount += 1;

      // Estimate compression ratio
      if (entry.transferSize && entry.decodedBodySize) {
        const ratio = 1 - (entry.transferSize / entry.decodedBodySize);
        this.metrics.compressionRatio = (this.metrics.compressionRatio + ratio) / 2;
      }

      // Check cache hit
      if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / this.metrics.chunkCount;
      }
    }
  }

  private optimizeResourceLoading(): void {
    if (typeof document !== 'undefined') {
      // Preload critical resources
      this.preloadCriticalResources();
      
      // Setup lazy loading for images and components
      this.setupLazyLoading();
      
      // Optimize font loading
      this.optimizeFontLoading();
    }
  }

  private preloadCriticalResources(): void {
    const criticalResources = [
      '/api/dashboard-data',
      '/api/user-info',
      '/api/products'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }

  private setupLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            this.loadLazyElement(element);
            observer.unobserve(element);
          }
        });
      }, {
        rootMargin: this.lazyLoadConfig.rootMargin,
        threshold: this.lazyLoadConfig.threshold
      });

      // Observe all lazy-loadable elements
      document.querySelectorAll('[data-lazy-load]').forEach(element => {
        observer.observe(element);
      });
    }
  }

  private loadLazyElement(element: HTMLElement): void {
    const componentName = element.dataset.lazyLoad;
    if (componentName && !this.loadedChunks.has(componentName)) {
      this.loadComponent(componentName);
    }
  }

  private optimizeFontLoading(): void {
    // Preload critical fonts
    const fontPreloads = [
      { family: 'Inter', weight: '400', display: 'swap' },
      { family: 'Inter', weight: '600', display: 'swap' }
    ];

    fontPreloads.forEach(font => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = `/fonts/${font.family}-${font.weight}.woff2`;
      document.head.appendChild(link);
    });
  }

  // Public API methods
  async loadComponent(componentName: string): Promise<any> {
    if (this.loadedChunks.has(componentName)) {
      return; // Already loaded
    }

    const startTime = performance.now();
    
    try {
      logger.logInfo(`Loading component chunk: ${componentName}`);
      
      // Dynamic import based on component name
      let component;
      switch (componentName) {
        case 'ProductManagement':
          component = await import('@/components/inventory/ProductManagement');
          break;
        case 'PayrollManagement':
          component = await import('@/components/payroll/PayrollRunManagement');
          break;
        case 'AnalyticsDashboard':
          component = await import('@/components/sales/SalesAnalytics');
          break;
        case 'ProductionDashboard':
          component = await import('@/components/monitoring/ProductionDashboard');
          break;
        default:
          throw new Error(`Unknown component: ${componentName}`);
      }

      this.loadedChunks.add(componentName);
      
      const loadTime = performance.now() - startTime;
      logger.logPerformance(`Component ${componentName} loaded`, {
        loadTime,
        chunkSize: 'estimated'
      });

      return component;
    } catch (error) {
      logger.logError(`Failed to load component ${componentName}`, error);
      throw error;
    }
  }

  preloadComponent(componentName: string): void {
    if (!this.preloadedChunks.has(componentName)) {
      this.preloadedChunks.add(componentName);
      
      // Use requestIdleCallback if available
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.loadComponent(componentName).catch(console.error);
        });
      } else {
        setTimeout(() => {
          this.loadComponent(componentName).catch(console.error);
        }, 1000);
      }
    }
  }

  optimizeForRoute(routeName: string): void {
    const routeOptimizations: Record<string, string[]> = {
      '/dashboard': ['AnalyticsDashboard'],
      '/inventory': ['ProductManagement'],
      '/payroll': ['PayrollManagement'],
      '/monitoring': ['ProductionDashboard'],
      '/pos': ['ProductSearch', 'PaymentComponent'],
      '/reports': ['ReportGenerator', 'DataExporter']
    };

    const componentsToPreload = routeOptimizations[routeName] || [];
    componentsToPreload.forEach(component => {
      this.preloadComponent(component);
    });
  }

  // Resource hints
  addResourceHint(url: string, type: 'prefetch' | 'preload' | 'dns-prefetch' = 'prefetch'): void {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = type;
      link.href = url;
      
      if (type === 'preload') {
        // Determine resource type
        if (url.includes('.js')) link.as = 'script';
        else if (url.includes('.css')) link.as = 'style';
        else if (url.includes('.woff')) link.as = 'font';
        else if (url.includes('.json')) link.as = 'fetch';
      }
      
      document.head.appendChild(link);
    }
  }

  // Service Worker integration for caching
  registerServiceWorker(): void {
    if ('serviceWorker' in navigator && PRODUCTION_CONFIG.enableServiceWorker) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          logger.logInfo('Service Worker registered successfully', {
            scope: registration.scope
          });

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  this.notifyUpdate();
                }
              });
            }
          });
        } catch (error) {
          logger.logError('Service Worker registration failed', error);
        }
      });
    }
  }

  private notifyUpdate(): void {
    // Notify user about app update
    if (typeof window !== 'undefined' && 'dispatchEvent' in window) {
      window.dispatchEvent(new CustomEvent('app-update-available'));
    }
  }

  // Analytics and metrics
  getBundleMetrics(): BundleMetrics {
    return { ...this.metrics };
  }

  getLoadedChunks(): string[] {
    return Array.from(this.loadedChunks);
  }

  getPreloadedChunks(): string[] {
    return Array.from(this.preloadedChunks);
  }

  // Optimization recommendations
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.compressionRatio < 0.6) {
      recommendations.push('Enable better compression (gzip/brotli) for JavaScript and CSS assets');
    }

    if (this.metrics.cacheHitRate < 0.8) {
      recommendations.push('Improve caching strategy with longer cache headers for static assets');
    }

    if (this.metrics.chunkCount > 20) {
      recommendations.push('Consider combining smaller chunks to reduce HTTP requests');
    }

    if (this.metrics.loadTime > 3000) {
      recommendations.push('Consider implementing more aggressive code splitting and lazy loading');
    }

    if (this.loadedChunks.size < 5) {
      recommendations.push('Implement more code splitting to reduce initial bundle size');
    }

    return recommendations;
  }
}

// React hook for bundle optimization
export const useBundleOptimization = () => {
  const [metrics, setMetrics] = React.useState<BundleMetrics | null>(null);
  
  React.useEffect(() => {
    const updateMetrics = () => {
      setMetrics(bundleOptimizer.getBundleMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    loadComponent: bundleOptimizer.loadComponent.bind(bundleOptimizer),
    preloadComponent: bundleOptimizer.preloadComponent.bind(bundleOptimizer),
    optimizeForRoute: bundleOptimizer.optimizeForRoute.bind(bundleOptimizer),
    getRecommendations: bundleOptimizer.getOptimizationRecommendations.bind(bundleOptimizer)
  };
};

// Global bundle optimizer instance
export const bundleOptimizer = new BundleOptimizer();

export default bundleOptimizer;
