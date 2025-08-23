
/**
 * Production Initialization Utility
 * Handles all production-specific setup and optimizations
 */

import { logger } from './production-logger';
import { productionDebugDisabler } from './production-debug-disabler';
import { isProduction } from './env-validator';

export interface ProductionInitConfig {
  disableDebugFeatures: boolean;
  enableSecurityHeaders: boolean;
  enablePerformanceMonitoring: boolean;
  enableErrorTracking: boolean;
  optimizeAssets: boolean;
}

class ProductionInitializer {
  private config: ProductionInitConfig;
  private isInitialized = false;

  constructor(config: ProductionInitConfig) {
    this.config = config;
  }

  /**
   * Initialize all production features
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Only run production initialization in production environment
      if (!isProduction()) {
        logger.logInfo('Skipping production initialization in development mode');
        this.isInitialized = true;
        return;
      }

      logger.logInfo('Starting production initialization...');

      // 1. Disable debug features
      if (this.config.disableDebugFeatures) {
        await this.disableDebugFeatures();
      }

      // 2. Enable security headers
      if (this.config.enableSecurityHeaders) {
        this.enableSecurityHeaders();
      }

      // 3. Initialize performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        await this.initializePerformanceMonitoring();
      }

      // 4. Setup error tracking
      if (this.config.enableErrorTracking) {
        this.setupErrorTracking();
      }

      // 5. Optimize assets
      if (this.config.optimizeAssets) {
        this.optimizeAssets();
      }

      // 6. Clean up development artifacts
      this.cleanupDevelopmentArtifacts();

      this.isInitialized = true;
      logger.logInfo('Production initialization completed successfully');

    } catch (error) {
      logger.logError('Production initialization failed', error as Error);
      // Continue with app startup even if initialization fails
      this.isInitialized = true;
    }
  }

  /**
   * Disable debug features for production
   */
  private async disableDebugFeatures(): Promise<void> {
    try {
      // Use the production debug disabler
      const status = productionDebugDisabler.getStatus();
      
      if (!status.debugDisabled) {
        logger.logWarning('Debug features are not fully disabled');
      }

      // Remove debug-related DOM elements
      this.removeDebugElements();

      // Disable React DevTools
      this.disableReactDevTools();

      logger.logInfo('Debug features disabled for production');
    } catch (error) {
      logger.logError('Failed to disable debug features', error as Error);
    }
  }

  /**
   * Enable security headers
   */
  private enableSecurityHeaders(): void {
    try {
      // Set security-related meta tags
      this.setSecurityMeta();

      // Configure CSP if supported
      this.configureCSP();

      logger.logInfo('Security headers configured');
    } catch (error) {
      logger.logError('Failed to configure security headers', error as Error);
    }
  }

  /**
   * Initialize performance monitoring
   */
  private async initializePerformanceMonitoring(): Promise<void> {
    try {
      // Performance observer for monitoring
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            // Log performance metrics for critical resources
            if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
              this.trackPerformanceMetric(entry);
            }
          });
        });

        observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
      }

      // Memory usage monitoring
      if ('memory' in performance) {
        this.monitorMemoryUsage();
      }

      logger.logInfo('Performance monitoring initialized');
    } catch (error) {
      logger.logError('Failed to initialize performance monitoring', error as Error);
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking(): void {
    try {
      // Global error handler
      window.addEventListener('error', (event) => {
        this.handleGlobalError(event.error, event.filename, event.lineno, event.colno);
      });

      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        this.handleUnhandledRejection(event.reason);
      });

      logger.logInfo('Error tracking configured');
    } catch (error) {
      logger.logError('Failed to setup error tracking', error as Error);
    }
  }

  /**
   * Optimize assets for production
   */
  private optimizeAssets(): void {
    try {
      // Preload critical resources
      this.preloadCriticalResources();

      // Enable resource hints
      this.enableResourceHints();

      // Optimize images
      this.optimizeImages();

      logger.logInfo('Asset optimization configured');
    } catch (error) {
      logger.logError('Failed to optimize assets', error as Error);
    }
  }

  /**
   * Clean up development artifacts
   */
  private cleanupDevelopmentArtifacts(): void {
    try {
      // Remove development-only attributes
      const devElements = document.querySelectorAll('[data-testid], [data-dev], [data-debug]');
      devElements.forEach(element => {
        element.removeAttribute('data-testid');
        element.removeAttribute('data-dev');
        element.removeAttribute('data-debug');
      });

      // Clean up development classes
      const elementsWithDevClasses = document.querySelectorAll('[class*="dev-"], [class*="debug-"], [class*="test-"]');
      elementsWithDevClasses.forEach(element => {
        element.className = element.className
          .split(' ')
          .filter(cls => !cls.startsWith('dev-') && !cls.startsWith('debug-') && !cls.startsWith('test-'))
          .join(' ');
      });

      logger.logInfo('Development artifacts cleaned up');
    } catch (error) {
      logger.logError('Failed to cleanup development artifacts', error as Error);
    }
  }

  /**
   * Remove debug-related DOM elements
   */
  private removeDebugElements(): void {
    const debugSelectors = [
      '[data-testid*="debug"]',
      '[data-debug="true"]',
      '[class*="debug-"]',
      '[id*="debug"]',
      '.debug-panel',
      '.dev-tools',
      '#react-refresh'
    ];

    debugSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
  }

  /**
   * Disable React DevTools
   */
  private disableReactDevTools(): void {
    if (typeof window !== 'undefined') {
      delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete (window as any).React;
      delete (window as any).ReactDOM;
      
      // Override the hook to prevent devtools from attaching
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        isDisabled: true,
        supportsFiber: true,
        inject: () => {},
        onCommitFiberRoot: () => {},
        onCommitFiberUnmount: () => {}
      };
    }
  }

  /**
   * Set security-related meta tags
   */
  private setSecurityMeta(): void {
    const securityMeta = [
      { name: 'referrer', content: 'strict-origin-when-cross-origin' },
      { name: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'X-Frame-Options', content: 'DENY' },
      { name: 'X-XSS-Protection', content: '1; mode=block' }
    ];

    securityMeta.forEach(meta => {
      let metaEl = document.querySelector(`meta[name="${meta.name}"]`) as HTMLMetaElement;
      if (!metaEl) {
        metaEl = document.createElement('meta');
        metaEl.name = meta.name;
        document.head.appendChild(metaEl);
      }
      metaEl.content = meta.content;
    });
  }

  /**
   * Configure Content Security Policy
   */
  private configureCSP(): void {
    // This would typically be done server-side, but we can add a meta tag as fallback
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;";
    
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
    if (!cspMeta) {
      cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      document.head.appendChild(cspMeta);
    }
    cspMeta.content = csp;
  }

  /**
   * Track performance metrics
   */
  private trackPerformanceMetric(entry: PerformanceEntry): void {
    // Only log significant performance issues
    if (entry.duration && entry.duration > 1000) { // More than 1 second
      logger.logWarning(`Performance: ${entry.name} took ${entry.duration}ms`);
    }
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    const checkMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usedRatio > 0.8) { // More than 80% memory usage
          logger.logWarning(`High memory usage: ${Math.round(usedRatio * 100)}%`);
        }
      }
    };

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000);
  }

  /**
   * Handle global errors
   */
  private handleGlobalError(error: Error, filename?: string, lineno?: number, colno?: number): void {
    logger.logError('Global Error', error, {
      filename,
      lineno,
      colno,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(reason: any): void {
    logger.logError('Unhandled Promise Rejection', new Error(String(reason)));
  }

  /**
   * Preload critical resources
   */
  private preloadCriticalResources(): void {
    const criticalResources = [
      { href: '/favicon.ico', as: 'image' },
      // Add other critical resources as needed
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      document.head.appendChild(link);
    });
  }

  /**
   * Enable resource hints
   */
  private enableResourceHints(): void {
    // DNS prefetch for external domains
    const externalDomains = [
      '//fonts.googleapis.com',
      '//fonts.gstatic.com'
    ];

    externalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize images
   */
  private optimizeImages(): void {
    // Add lazy loading to images that don't have it
    const images = document.querySelectorAll('img:not([loading])') as NodeListOf<HTMLImageElement>;
    images.forEach(img => {
      if (!img.loading) {
        img.loading = 'lazy';
      }
    });
  }

  /**
   * Get initialization status
   */
  getStatus(): { initialized: boolean; config: ProductionInitConfig } {
    return {
      initialized: this.isInitialized,
      config: this.config
    };
  }
}

// Create and export singleton instance
export const productionInitializer = new ProductionInitializer({
  disableDebugFeatures: true,
  enableSecurityHeaders: true,
  enablePerformanceMonitoring: true,
  enableErrorTracking: true,
  optimizeAssets: true
});

// Export convenience function
export const initializeProductionSecurity = async () => {
  await productionInitializer.initialize();
};

export default productionInitializer;
