
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import React from 'react';

interface PerformanceMetric {
  id: string;
  name: string;
  category: 'database' | 'api' | 'render' | 'memory' | 'network' | 'pos' | 'inventory' | 'payroll';
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  success?: boolean;
  error?: string;
}

interface PerformanceThresholds {
  database: number;
  api: number;
  render: number;
  memory: number;
  network: number;
  pos: number;
  inventory: number;
  payroll: number;
}

interface SystemHealthMetrics {
  cpu: number;
  memory: number;
  network: number;
  database: number;
  errors: number;
  timestamp: number;
}

class EnhancedPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeMetrics: Map<string, PerformanceMetric> = new Map();
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = false;
  private healthMetrics: SystemHealthMetrics[] = [];
  private alertCallbacks: ((metric: PerformanceMetric) => void)[] = [];

  private thresholds: PerformanceThresholds = {
    database: 1000, // 1s
    api: 2000, // 2s
    render: 100, // 100ms
    memory: 50 * 1024 * 1024, // 50MB
    network: 3000, // 3s
    pos: 500, // 500ms for POS operations
    inventory: 800, // 800ms for inventory operations
    payroll: 2000 // 2s for payroll processing
  };

  constructor() {
    this.isEnabled = PRODUCTION_CONFIG.enablePerformanceMonitoring;
    if (this.isEnabled) {
      this.initializeObservers();
      this.startMemoryMonitoring();
      this.startSystemHealthMonitoring();
      this.setupPeriodicCleanup();
      this.initializeCriticalPathMonitoring();
    }
  }

  private initializeObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    // Long Task Observer
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            id: `longtask_${Date.now()}`,
            name: 'Long Task',
            category: 'render',
            startTime: entry.startTime,
            endTime: entry.startTime + entry.duration,
            duration: entry.duration,
            metadata: { attribution: entry.attribution },
            success: entry.duration < this.thresholds.render
          });

          if (entry.duration > 50) {
            logger.logPerformance('Long Task Detected', {
              duration: entry.duration,
              startTime: entry.startTime,
              attribution: entry.attribution
            });
          }
        });
      });

      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (error) {
      logger.logWarn('Failed to initialize long task observer', error);
    }

    // Navigation Observer
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          this.recordMetric({
            id: `navigation_${Date.now()}`,
            name: 'Page Navigation',
            category: 'network',
            startTime: entry.startTime,
            endTime: entry.loadEventEnd,
            duration: entry.loadEventEnd - entry.startTime,
            metadata: {
              domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
              firstPaint: entry.firstPaint,
              firstContentfulPaint: entry.firstContentfulPaint,
              largestContentfulPaint: entry.largestContentfulPaint
            },
            success: true
          });
        });
      });

      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    } catch (error) {
      logger.logWarn('Failed to initialize navigation observer', error);
    }

    // Resource Observer
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.duration > this.thresholds.network / 10) {
            this.recordMetric({
              id: `resource_${Date.now()}_${Math.random()}`,
              name: `Resource: ${entry.name.split('/').pop()}`,
              category: 'network',
              startTime: entry.startTime,
              endTime: entry.responseEnd,
              duration: entry.duration,
              metadata: {
                url: entry.name,
                size: entry.transferSize,
                type: entry.initiatorType,
                protocol: entry.nextHopProtocol
              },
              success: entry.duration < this.thresholds.network
            });
          }
        });
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      logger.logWarn('Failed to initialize resource observer', error);
    }

    // Measure Observer for custom metrics
    try {
      const measureObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name.startsWith('app-')) {
            this.recordMetric({
              id: `measure_${Date.now()}`,
              name: entry.name,
              category: 'api',
              startTime: entry.startTime,
              endTime: entry.startTime + entry.duration,
              duration: entry.duration,
              success: entry.duration < this.thresholds.api
            });
          }
        });
      });

      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(measureObserver);
    } catch (error) {
      logger.logWarn('Failed to initialize measure observer', error);
    }
  }

  private startMemoryMonitoring(): void {
    if (!('memory' in performance)) return;

    const checkMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        const usedMemory = memory.usedJSHeapSize;
        const totalMemory = memory.totalJSHeapSize;
        const memoryLimit = memory.jsHeapSizeLimit;

        this.recordMetric({
          id: `memory_${Date.now()}`,
          name: 'Memory Usage',
          category: 'memory',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          metadata: {
            used: usedMemory,
            total: totalMemory,
            limit: memoryLimit,
            percentage: usedMemory / memoryLimit * 100
          },
          success: usedMemory < this.thresholds.memory
        });

        // Critical memory alert
        if (usedMemory > memoryLimit * 0.9) {
          logger.logError('Critical Memory Usage Detected', {
            used: usedMemory,
            limit: memoryLimit,
            percentage: usedMemory / memoryLimit * 100
          });

          this.triggerAlert({
            id: `memory_alert_${Date.now()}`,
            name: 'Critical Memory Usage',
            category: 'memory',
            startTime: Date.now(),
            metadata: { used: usedMemory, limit: memoryLimit },
            success: false
          });
        }
      }
    };

    setInterval(checkMemory, 15000); // Check every 15 seconds
    checkMemory();
  }

  private startSystemHealthMonitoring(): void {
    const checkSystemHealth = () => {
      const healthMetric: SystemHealthMetrics = {
        cpu: this.getCPUUsage(),
        memory: this.getMemoryUsage(),
        network: this.getNetworkHealth(),
        database: this.getDatabaseHealth(),
        errors: this.getErrorRate(),
        timestamp: Date.now()
      };

      this.healthMetrics.push(healthMetric);

      // Keep only last 100 health metrics
      if (this.healthMetrics.length > 100) {
        this.healthMetrics = this.healthMetrics.slice(-100);
      }

      // Alert on unhealthy systems
      if (healthMetric.cpu > 80 || healthMetric.memory > 90 || healthMetric.errors > 10) {
        logger.logWarn('System Health Alert', healthMetric);
      }
    };

    setInterval(checkSystemHealth, 30000); // Check every 30 seconds
    checkSystemHealth();
  }

  private initializeCriticalPathMonitoring(): void {
    // Monitor POS transaction performance
    this.monitorCriticalPath('pos-transaction', 'pos');

    // Monitor inventory updates
    this.monitorCriticalPath('inventory-update', 'inventory');

    // Monitor payroll processing
    this.monitorCriticalPath('payroll-process', 'payroll');
  }

  private monitorCriticalPath(operationType: string, category: PerformanceMetric['category']): void {
    window.addEventListener(`${operationType}-start`, ((event: CustomEvent) => {
      const { operationId, metadata } = event.detail;
      this.startTiming(operationId, operationType, category, metadata);
    }) as EventListener);

    window.addEventListener(`${operationType}-end`, ((event: CustomEvent) => {
      const { operationId, success, error } = event.detail;
      this.endTiming(operationId, success, error);
    }) as EventListener);
  }

  private getCPUUsage(): number {
    // Estimate CPU usage based on frame timing
    if ('requestIdleCallback' in window) {
      return Math.min(100, Math.max(0, 100 - performance.now() % 100));
    }
    return 0;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100;
    }
    return 0;
  }

  private getNetworkHealth(): number {
    const recentNetworkMetrics = this.metrics.
    filter((m) => m.category === 'network' && m.startTime > Date.now() - 60000).
    filter((m) => m.success !== undefined);

    if (recentNetworkMetrics.length === 0) return 100;

    const successRate = recentNetworkMetrics.filter((m) => m.success).length / recentNetworkMetrics.length * 100;
    return successRate;
  }

  private getDatabaseHealth(): number {
    const recentDbMetrics = this.metrics.
    filter((m) => m.category === 'database' && m.startTime > Date.now() - 60000).
    filter((m) => m.success !== undefined);

    if (recentDbMetrics.length === 0) return 100;

    const successRate = recentDbMetrics.filter((m) => m.success).length / recentDbMetrics.length * 100;
    return successRate;
  }

  private getErrorRate(): number {
    const recentMetrics = this.metrics.filter((m) => m.startTime > Date.now() - 60000);
    if (recentMetrics.length === 0) return 0;

    return recentMetrics.filter((m) => !m.success).length / recentMetrics.length * 100;
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      this.metrics = this.metrics.filter((metric) => metric.startTime > cutoff);

      // Clean up active metrics that are too old
      for (const [id, metric] of this.activeMetrics.entries()) {
        if (metric.startTime < cutoff) {
          this.activeMetrics.delete(id);
        }
      }

      logger.logDebug('Performance metrics cleaned up', {
        remainingMetrics: this.metrics.length,
        activeMetrics: this.activeMetrics.size
      });
    }, 5 * 60 * 1000);
  }

  private triggerAlert(metric: PerformanceMetric): void {
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(metric);
      } catch (error) {
        logger.logError('Alert callback failed', error);
      }
    });
  }

  // Public API methods
  startTiming(id: string, name: string, category: PerformanceMetric['category'], metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      id,
      name,
      category,
      startTime: performance.now(),
      metadata
    };

    this.activeMetrics.set(id, metric);

    // Mark performance for custom measurement
    if ('mark' in performance) {
      performance.mark(`app-${id}-start`);
    }
  }

  endTiming(id: string, success: boolean = true, error?: string): void {
    if (!this.isEnabled) return;

    const metric = this.activeMetrics.get(id);
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      metric.error = error;

      this.recordMetric(metric);
      this.activeMetrics.delete(id);

      // Mark performance end and measure
      if ('mark' in performance && 'measure' in performance) {
        performance.mark(`app-${id}-end`);
        performance.measure(`app-${metric.name}`, `app-${id}-start`, `app-${id}-end`);
      }

      // Check thresholds and log slow operations
      const threshold = this.thresholds[metric.category];
      if (metric.duration > threshold) {
        logger.logWarn(`Slow ${metric.category} operation detected`, {
          name: metric.name,
          duration: metric.duration,
          threshold,
          metadata: metric.metadata
        });

        // Trigger alert for critical operations
        if (metric.category === 'pos' || metric.category === 'payroll') {
          this.triggerAlert(metric);
        }
      }
    }
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Emit custom event for real-time monitoring
    window.dispatchEvent(new CustomEvent('performance-metric', {
      detail: metric
    }));

    // Log to production logger for audit trail
    logger.logPerformance(`${metric.category}:${metric.name}`, {
      duration: metric.duration,
      success: metric.success,
      error: metric.error,
      metadata: metric.metadata
    });
  }

  // Alert management
  onAlert(callback: (metric: PerformanceMetric) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  // Data retrieval methods
  getMetrics(category?: PerformanceMetric['category'], limit: number = 100): PerformanceMetric[] {
    let filteredMetrics = this.metrics;

    if (category) {
      filteredMetrics = filteredMetrics.filter((m) => m.category === category);
    }

    return filteredMetrics.
    sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).
    slice(0, limit);
  }

  getSystemHealth(): SystemHealthMetrics | null {
    return this.healthMetrics.length > 0 ? this.healthMetrics[this.healthMetrics.length - 1] : null;
  }

  getHealthHistory(minutes: number = 60): SystemHealthMetrics[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.healthMetrics.filter((h) => h.timestamp > cutoff);
  }

  getPerformanceReport(): {
    summary: Record<string, any>;
    categories: Record<string, any>;
    slowOperations: PerformanceMetric[];
    recommendations: string[];
    systemHealth: SystemHealthMetrics | null;
    criticalIssues: string[];
  } {
    const now = Date.now();
    const recentMetrics = this.metrics.filter((m) => m.startTime > now - 60 * 60 * 1000);

    const summary = {
      totalMetrics: recentMetrics.length,
      averageDuration: recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / recentMetrics.length :
      0,
      successRate: recentMetrics.length > 0 ?
      recentMetrics.filter((m) => m.success).length / recentMetrics.length * 100 :
      100,
      timeRange: '1 hour',
      activeOperations: this.activeMetrics.size
    };

    const categories = Object.keys(this.thresholds).reduce((acc, category) => {
      const categoryMetrics = recentMetrics.filter((m) => m.category === category);
      acc[category] = {
        count: categoryMetrics.length,
        averageDuration: categoryMetrics.length > 0 ?
        categoryMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / categoryMetrics.length :
        0,
        slowOperations: categoryMetrics.filter((m) => (m.duration || 0) > this.thresholds[category as keyof PerformanceThresholds]).length,
        errorRate: categoryMetrics.length > 0 ?
        categoryMetrics.filter((m) => !m.success).length / categoryMetrics.length * 100 :
        0
      };
      return acc;
    }, {} as Record<string, any>);

    const slowOperations = recentMetrics.
    filter((m) => (m.duration || 0) > this.thresholds[m.category]).
    sort((a, b) => (b.duration || 0) - (a.duration || 0)).
    slice(0, 10);

    const recommendations = this.generateRecommendations(categories, slowOperations);
    const criticalIssues = this.identifyCriticalIssues(categories, this.getSystemHealth());

    return {
      summary,
      categories,
      slowOperations,
      recommendations,
      systemHealth: this.getSystemHealth(),
      criticalIssues
    };
  }

  private generateRecommendations(categories: Record<string, any>, slowOperations: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    // Database recommendations
    if (categories.database?.slowOperations > 3) {
      recommendations.push('Consider adding database indexes or optimizing queries for better performance');
    }

    // API recommendations
    if (categories.api?.slowOperations > 2) {
      recommendations.push('Implement API response caching or reduce payload size to improve response times');
    }

    // Render recommendations
    if (categories.render?.slowOperations > 5) {
      recommendations.push('Consider code splitting or lazy loading components to improve render performance');
    }

    // Memory recommendations
    if (categories.memory?.slowOperations > 0) {
      recommendations.push('Review memory usage patterns and implement proper cleanup to prevent leaks');
    }

    // Network recommendations
    if (categories.network?.slowOperations > 3) {
      recommendations.push('Optimize asset sizes or implement CDN for better network performance');
    }

    // POS-specific recommendations
    if (categories.pos?.slowOperations > 1) {
      recommendations.push('Critical: POS transaction performance issues detected - investigate database queries and network calls');
    }

    // Inventory-specific recommendations
    if (categories.inventory?.slowOperations > 2) {
      recommendations.push('Inventory operations are slow - consider batch processing or background updates');
    }

    // Payroll-specific recommendations
    if (categories.payroll?.slowOperations > 0) {
      recommendations.push('Payroll processing performance issues - optimize calculations or implement background processing');
    }

    return recommendations;
  }

  private identifyCriticalIssues(categories: Record<string, any>, systemHealth: SystemHealthMetrics | null): string[] {
    const issues: string[] = [];

    // Critical performance issues
    if (categories.pos?.errorRate > 5) {
      issues.push('Critical: High error rate in POS transactions');
    }

    if (categories.database?.errorRate > 10) {
      issues.push('Critical: High database error rate detected');
    }

    // System health issues
    if (systemHealth) {
      if (systemHealth.memory > 90) {
        issues.push('Critical: Memory usage critically high');
      }
      if (systemHealth.cpu > 90) {
        issues.push('Critical: CPU usage critically high');
      }
      if (systemHealth.errors > 15) {
        issues.push('Critical: High system error rate');
      }
    }

    return issues;
  }

  // Utility methods
  clearMetrics(): void {
    this.metrics = [];
    this.healthMetrics = [];
    logger.logInfo('Performance metrics cleared');
  }

  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      healthMetrics: this.healthMetrics,
      thresholds: this.thresholds,
      timestamp: Date.now()
    }, null, 2);
  }

  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.metrics = [];
    this.healthMetrics = [];
    this.activeMetrics.clear();
    this.alertCallbacks = [];
    this.isEnabled = false;
    logger.logInfo('Performance monitor destroyed');
  }
}

// Global instance
export const enhancedPerformanceMonitor = new EnhancedPerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = React.useState<PerformanceMetric[]>([]);
  const [report, setReport] = React.useState<any>(null);
  const [systemHealth, setSystemHealth] = React.useState<SystemHealthMetrics | null>(null);

  React.useEffect(() => {
    const handleMetric = (event: CustomEvent) => {
      setMetrics((prev) => [...prev.slice(-99), event.detail]);
    };

    window.addEventListener('performance-metric', handleMetric as EventListener);

    // Update report and system health every 30 seconds
    const updateInterval = setInterval(() => {
      setReport(enhancedPerformanceMonitor.getPerformanceReport());
      setSystemHealth(enhancedPerformanceMonitor.getSystemHealth());
    }, 30000);

    // Initial load
    setReport(enhancedPerformanceMonitor.getPerformanceReport());
    setSystemHealth(enhancedPerformanceMonitor.getSystemHealth());

    return () => {
      window.removeEventListener('performance-metric', handleMetric as EventListener);
      clearInterval(updateInterval);
    };
  }, []);

  return {
    metrics,
    report,
    systemHealth,
    startTiming: enhancedPerformanceMonitor.startTiming.bind(enhancedPerformanceMonitor),
    endTiming: enhancedPerformanceMonitor.endTiming.bind(enhancedPerformanceMonitor),
    onAlert: enhancedPerformanceMonitor.onAlert.bind(enhancedPerformanceMonitor)
  };
};

// HOC for automatic performance tracking
export const withPerformanceTracking = <P extends object,>(
Component: React.ComponentType<P>,
componentName: string)
: React.ComponentType<P> => {
  return React.memo((props: P) => {
    React.useLayoutEffect(() => {
      const id = `render_${componentName}_${Date.now()}`;
      enhancedPerformanceMonitor.startTiming(id, `Render: ${componentName}`, 'render');

      return () => {
        enhancedPerformanceMonitor.endTiming(id, true);
      };
    });

    return React.createElement(Component, props);
  });
};

export default enhancedPerformanceMonitor;