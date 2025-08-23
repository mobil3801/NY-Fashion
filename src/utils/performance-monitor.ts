
export interface PerformanceConfig {
  enabled?: boolean;
  bufferSize?: number;
  flushInterval?: number;
  onFlush?: (data: any) => void;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'counter' | 'gauge' | 'size';
  tags?: Record<string, string>;
}

export interface PerformanceIssue {
  type: 'threshold_exceeded' | 'memory_pressure' | 'long_task' | 'slow_interaction';
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  details: any;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    averageResponseTime: number;
    memoryUsage: number;
    errorRate: number;
    totalRequests: number;
  };
  issues: PerformanceIssue[];
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface NavigationMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
}

export interface ResourceMetrics {
  url: string;
  duration: number;
  size: number;
  type: string;
}

export interface InteractionMetrics {
  totalInteractions: number;
  averageResponseTime: number;
  slowInteractions: number;
}

export interface UserInteraction {
  type: string;
  target: string;
  startTime: number;
  duration: number;
}

export class PerformanceMonitor {
  private config: Required<PerformanceConfig>;
  private metrics: PerformanceMetric[] = [];
  private issues: PerformanceIssue[] = [];
  private observers: PerformanceObserver[] = [];
  private intervals: number[] = [];
  private issueCallbacks: Array<(issue: PerformanceIssue) => void> = [];
  private enabled: boolean = true;

  constructor(config: PerformanceConfig = {}) {
    this.config = {
      enabled: true,
      bufferSize: 1000,
      flushInterval: 30000, // 30 seconds
      onFlush: () => {},
      ...config
    };

    this.enabled = this.config.enabled;

    if (this.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    this.setupPerformanceObservers();
    this.setupPeriodicFlush();
    this.startMonitoring();
  }

  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      // Long task observer
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordLongTask(entry as any);
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);

      // Navigation observer
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordNavigationTiming(entry as any);
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);

      // Resource observer
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordResourceTiming(entry as any);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

    } catch (error) {
      console.warn('Failed to set up performance observers:', error);
    }
  }

  private setupPeriodicFlush(): void {
    const interval = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
    
    this.intervals.push(interval);
  }

  private startMonitoring(): void {
    // Monitor memory usage periodically
    const memoryInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 5000);
    
    this.intervals.push(memoryInterval);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  startTiming(name: string): number {
    if (!this.enabled) return 0;

    const startTime = performance.now();
    
    try {
      performance.mark(`${name}-start`);
    } catch (error) {
      // Ignore errors if performance API is not available
    }

    return startTime;
  }

  endTiming(name: string, startTime: number): number {
    if (!this.enabled) return 0;

    const duration = performance.now() - startTime;

    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch (error) {
      // Ignore errors if performance API is not available
    }

    this.recordMetric(name, duration, { type: 'timing' });
    return duration;
  }

  recordMetric(name: string, value: number, options: {
    type?: 'timing' | 'counter' | 'gauge' | 'size';
    tags?: Record<string, string>;
    threshold?: number;
  } = {}): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type: options.type || 'gauge',
      tags: options.tags
    };

    this.addMetric(metric);

    // Check threshold
    if (options.threshold && value > options.threshold) {
      this.recordIssue({
        type: 'threshold_exceeded',
        severity: 'medium',
        timestamp: Date.now(),
        details: {
          metric: name,
          value,
          threshold: options.threshold
        }
      });
    }
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Maintain buffer size
    if (this.metrics.length > this.config.bufferSize) {
      this.metrics = this.metrics.slice(-this.config.bufferSize);
    }
  }

  getMemoryMetrics(): MemoryMetrics {
    const memory = (performance as any).memory;
    
    if (!memory) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      };
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }

  getNavigationMetrics(): NavigationMetrics {
    const entries = performance.getEntriesByType('navigation') as any[];
    
    if (entries.length === 0) {
      return {
        domContentLoaded: 0,
        loadComplete: 0,
        firstPaint: 0,
        firstContentfulPaint: 0
      };
    }

    const navigation = entries[0];
    const fetchStart = navigation.fetchStart;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - fetchStart,
      loadComplete: navigation.loadEventEnd - fetchStart,
      firstPaint: navigation.firstPaint || 0,
      firstContentfulPaint: navigation.firstContentfulPaint || 0
    };
  }

  checkMemoryPressure(): void {
    const memory = this.getMemoryMetrics();
    
    if (memory.jsHeapSizeLimit === 0) return;

    const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    if (usagePercentage > 90) {
      this.recordIssue({
        type: 'memory_pressure',
        severity: 'high',
        timestamp: Date.now(),
        details: {
          usagePercentage,
          usedJSHeapSize: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      });
    } else if (usagePercentage > 75) {
      this.recordIssue({
        type: 'memory_pressure',
        severity: 'medium',
        timestamp: Date.now(),
        details: {
          usagePercentage,
          usedJSHeapSize: memory.usedJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        }
      });
    }
  }

  recordLongTask(entry: any): void {
    this.recordIssue({
      type: 'long_task',
      severity: entry.duration > 100 ? 'high' : 'medium',
      timestamp: Date.now(),
      details: {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name
      }
    });
  }

  private recordNavigationTiming(entry: any): void {
    const metrics = [
      { name: 'dns-lookup', value: entry.domainLookupEnd - entry.domainLookupStart },
      { name: 'tcp-connect', value: entry.connectEnd - entry.connectStart },
      { name: 'request-time', value: entry.responseStart - entry.requestStart },
      { name: 'response-time', value: entry.responseEnd - entry.responseStart },
      { name: 'dom-processing', value: entry.domComplete - entry.domLoading }
    ];

    metrics.forEach(metric => {
      if (metric.value > 0) {
        this.recordMetric(metric.name, metric.value, { type: 'timing' });
      }
    });
  }

  private recordResourceTiming(entry: any): void {
    this.recordMetric('resource-load-time', entry.duration, {
      type: 'timing',
      tags: {
        resource: entry.name,
        type: entry.initiatorType
      }
    });

    if (entry.transferSize > 0) {
      this.recordMetric('resource-size', entry.transferSize, {
        type: 'size',
        tags: {
          resource: entry.name,
          type: entry.initiatorType
        }
      });
    }
  }

  getResourceMetrics(): ResourceMetrics[] {
    const entries = performance.getEntriesByType('resource') as any[];
    
    return entries.map(entry => ({
      url: entry.name,
      duration: entry.duration,
      size: entry.transferSize || 0,
      type: entry.initiatorType
    }));
  }

  getSlowResources(threshold: number = 1000): ResourceMetrics[] {
    return this.getResourceMetrics().filter(resource => resource.duration > threshold);
  }

  recordUserInteraction(interaction: UserInteraction): void {
    this.recordMetric('user-interaction', interaction.duration, {
      type: 'timing',
      tags: {
        type: interaction.type,
        target: interaction.target
      }
    });

    if (interaction.duration > 100) {
      this.recordIssue({
        type: 'slow_interaction',
        severity: interaction.duration > 300 ? 'high' : 'medium',
        timestamp: Date.now(),
        details: {
          interaction: interaction.type,
          target: interaction.target,
          duration: interaction.duration
        }
      });
    }
  }

  getInteractionMetrics(): InteractionMetrics {
    const interactionMetrics = this.metrics.filter(m => 
      m.name === 'user-interaction'
    );

    const totalInteractions = interactionMetrics.length;
    const averageResponseTime = totalInteractions > 0 
      ? interactionMetrics.reduce((sum, m) => sum + m.value, 0) / totalInteractions
      : 0;
    const slowInteractions = interactionMetrics.filter(m => m.value > 100).length;

    return {
      totalInteractions,
      averageResponseTime,
      slowInteractions
    };
  }

  private recordIssue(issue: PerformanceIssue): void {
    this.issues.push(issue);
    
    // Notify callbacks
    this.issueCallbacks.forEach(callback => {
      try {
        callback(issue);
      } catch (error) {
        console.error('Error in performance issue callback:', error);
      }
    });
  }

  onPerformanceIssue(callback: (issue: PerformanceIssue) => void): () => void {
    this.issueCallbacks.push(callback);
    
    return () => {
      const index = this.issueCallbacks.indexOf(callback);
      if (index > -1) {
        this.issueCallbacks.splice(index, 1);
      }
    };
  }

  generateReport(): PerformanceReport {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes

    const timingMetrics = recentMetrics.filter(m => m.type === 'timing');
    const averageResponseTime = timingMetrics.length > 0
      ? timingMetrics.reduce((sum, m) => sum + m.value, 0) / timingMetrics.length
      : 0;

    const memory = this.getMemoryMetrics();
    const memoryUsage = memory.jsHeapSizeLimit > 0
      ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      : 0;

    const errorMetrics = recentMetrics.filter(m => m.name.includes('error'));
    const totalRequests = recentMetrics.filter(m => m.name.includes('request')).length;
    const errorRate = totalRequests > 0 ? (errorMetrics.length / totalRequests) * 100 : 0;

    return {
      timestamp: now,
      metrics: [...recentMetrics],
      summary: {
        averageResponseTime,
        memoryUsage,
        errorRate,
        totalRequests
      },
      issues: [...this.issues.filter(i => now - i.timestamp < 300000)]
    };
  }

  calculatePerformanceScore(): number {
    const navigation = this.getNavigationMetrics();
    const memory = this.getMemoryMetrics();
    const issues = this.issues.filter(i => Date.now() - i.timestamp < 300000);

    let score = 100;

    // Deduct points for slow loading
    if (navigation.domContentLoaded > 3000) score -= 20;
    else if (navigation.domContentLoaded > 1500) score -= 10;

    if (navigation.firstContentfulPaint > 2500) score -= 15;
    else if (navigation.firstContentfulPaint > 1000) score -= 5;

    // Deduct points for high memory usage
    if (memory.jsHeapSizeLimit > 0) {
      const memoryUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (memoryUsage > 80) score -= 20;
      else if (memoryUsage > 60) score -= 10;
    }

    // Deduct points for performance issues
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    
    score -= highIssues * 10;
    score -= mediumIssues * 5;

    return Math.max(0, Math.min(100, score));
  }

  getPerformanceTrends(metricName: string): {
    average: number;
    trend: 'improving' | 'degrading' | 'stable';
    samples: number;
  } {
    const relevantMetrics = this.metrics
      .filter(m => m.name === metricName)
      .slice(-20); // Last 20 samples

    if (relevantMetrics.length < 2) {
      return {
        average: relevantMetrics[0]?.value || 0,
        trend: 'stable',
        samples: relevantMetrics.length
      };
    }

    const average = relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
    
    // Compare first half with second half to determine trend
    const firstHalf = relevantMetrics.slice(0, Math.floor(relevantMetrics.length / 2));
    const secondHalf = relevantMetrics.slice(Math.floor(relevantMetrics.length / 2));
    
    const firstAverage = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondAverage = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
    
    const difference = secondAverage - firstAverage;
    const threshold = average * 0.05; // 5% threshold
    
    let trend: 'improving' | 'degrading' | 'stable';
    if (difference > threshold) {
      trend = 'degrading'; // Higher values are usually worse
    } else if (difference < -threshold) {
      trend = 'improving';
    } else {
      trend = 'stable';
    }

    return {
      average,
      trend,
      samples: relevantMetrics.length
    };
  }

  private flush(): void {
    if (this.metrics.length === 0) return;

    try {
      this.config.onFlush({
        metrics: [...this.metrics],
        issues: [...this.issues],
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error in performance monitor flush:', error);
    }
  }

  exportData(): any {
    return {
      metrics: [...this.metrics],
      issues: [...this.issues],
      timestamp: Date.now()
    };
  }

  importData(data: any): void {
    if (data.metrics && Array.isArray(data.metrics)) {
      this.metrics = [...data.metrics];
    }
    
    if (data.issues && Array.isArray(data.issues)) {
      this.issues = [...data.issues];
    }
  }

  logToDevTools(): void {
    if (typeof console.table === 'function') {
      const recentMetrics = this.metrics.slice(-10);
      console.table(recentMetrics);
    }
  }

  getDebugInfo(): any {
    return {
      isEnabled: this.enabled,
      bufferSize: this.config.bufferSize,
      metricsCount: this.metrics.length,
      issuesCount: this.issues.length,
      observersActive: this.observers.length
    };
  }

  destroy(): void {
    this.enabled = false;

    // Clean up observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.observers = [];

    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Clear callbacks
    this.issueCallbacks = [];

    // Clear data
    this.metrics = [];
    this.issues = [];
  }
}
