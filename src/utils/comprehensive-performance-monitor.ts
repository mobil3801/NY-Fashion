
interface PerformanceMetric {
  type: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  pageUrl: string;
  sessionId: string;
}

interface PerformanceThreshold {
  metricType: string;
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  enabled: boolean;
}

interface PerformanceAlert {
  type: 'threshold_exceeded' | 'optimization_needed';
  metricType: string;
  currentValue: number;
  thresholdValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendations: string[];
  pageUrl: string;
}

class ComprehensivePerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private sessionId: string;
  private observer: PerformanceObserver | null = null;
  private memoryMonitorInterval: NodeJS.Timeout | null = null;
  private apiMetrics: Map<string, number[]> = new Map();
  private userInteractionStartTime: number = 0;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeDefaultThresholds();
    this.setupPerformanceObserver();
    this.setupMemoryMonitoring();
    this.setupNavigationTimingMonitoring();
    this.setupUserInteractionMonitoring();
    this.setupAPIMonitoring();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaultThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      { metricType: 'load_time', metricName: 'page_load', warningThreshold: 3000, criticalThreshold: 5000, unit: 'ms', enabled: true },
      { metricType: 'load_time', metricName: 'first_contentful_paint', warningThreshold: 1800, criticalThreshold: 3000, unit: 'ms', enabled: true },
      { metricType: 'load_time', metricName: 'largest_contentful_paint', warningThreshold: 2500, criticalThreshold: 4000, unit: 'ms', enabled: true },
      { metricType: 'api_response', metricName: 'api_call', warningThreshold: 1000, criticalThreshold: 3000, unit: 'ms', enabled: true },
      { metricType: 'memory', metricName: 'heap_used', warningThreshold: 100, criticalThreshold: 200, unit: 'MB', enabled: true },
      { metricType: 'interaction', metricName: 'click_response', warningThreshold: 100, criticalThreshold: 300, unit: 'ms', enabled: true }
    ];

    defaultThresholds.forEach(threshold => {
      const key = `${threshold.metricType}_${threshold.metricName}`;
      this.thresholds.set(key, threshold);
    });
  }

  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.processPerformanceEntry(entry);
        });
      });

      try {
        this.observer.observe({ entryTypes: ['measure', 'navigation', 'paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (e) {
        console.warn('Some performance entry types not supported:', e);
      }
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    let metricType = 'performance';
    let metricName = entry.name;
    let value = 0;
    let unit = 'ms';

    switch (entry.entryType) {
      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.recordMetric('load_time', 'page_load', navEntry.loadEventEnd - navEntry.fetchStart, 'ms');
        this.recordMetric('load_time', 'dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'ms');
        this.recordMetric('load_time', 'first_byte', navEntry.responseStart - navEntry.fetchStart, 'ms');
        break;

      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('load_time', 'first_contentful_paint', entry.startTime, 'ms');
        }
        break;

      case 'largest-contentful-paint':
        this.recordMetric('load_time', 'largest_contentful_paint', entry.startTime, 'ms');
        break;

      case 'first-input':
        const fiEntry = entry as any;
        this.recordMetric('interaction', 'first_input_delay', fiEntry.processingStart - fiEntry.startTime, 'ms');
        break;

      case 'layout-shift':
        const clsEntry = entry as any;
        if (!clsEntry.hadRecentInput) {
          this.recordMetric('performance', 'cumulative_layout_shift', clsEntry.value, 'score');
        }
        break;
    }
  }

  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryMonitorInterval = setInterval(() => {
        const memory = (performance as any).memory;
        this.recordMetric('memory', 'heap_used', memory.usedJSHeapSize / 1024 / 1024, 'MB');
        this.recordMetric('memory', 'heap_total', memory.totalJSHeapSize / 1024 / 1024, 'MB');
        this.recordMetric('memory', 'heap_limit', memory.jsHeapSizeLimit / 1024 / 1024, 'MB');
      }, 10000); // Every 10 seconds
    }
  }

  private setupNavigationTimingMonitoring(): void {
    if ('getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      navigationEntries.forEach(entry => {
        this.recordMetric('load_time', 'dns_lookup', entry.domainLookupEnd - entry.domainLookupStart, 'ms');
        this.recordMetric('load_time', 'tcp_connection', entry.connectEnd - entry.connectStart, 'ms');
        this.recordMetric('load_time', 'server_response', entry.responseEnd - entry.requestStart, 'ms');
      });
    }
  }

  private setupUserInteractionMonitoring(): void {
    ['click', 'keydown', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.userInteractionStartTime = performance.now();
        
        // Monitor response time for interactions
        requestAnimationFrame(() => {
          const responseTime = performance.now() - this.userInteractionStartTime;
          this.recordMetric('interaction', `${eventType}_response`, responseTime, 'ms');
        });
      });
    });
  }

  private setupAPIMonitoring(): void {
    // Monitor fetch API
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0]?.toString() || 'unknown';
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.recordMetric('api_response', this.extractAPIEndpoint(url), duration, 'ms');
        this.trackAPIMetrics(url, duration);
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.recordMetric('api_response', `${this.extractAPIEndpoint(url)}_error`, duration, 'ms');
        throw error;
      }
    };
  }

  private extractAPIEndpoint(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.pathname.split('/').filter(Boolean).join('_') || 'root';
    } catch {
      return 'unknown';
    }
  }

  private trackAPIMetrics(url: string, duration: number): void {
    const endpoint = this.extractAPIEndpoint(url);
    if (!this.apiMetrics.has(endpoint)) {
      this.apiMetrics.set(endpoint, []);
    }
    
    const metrics = this.apiMetrics.get(endpoint)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  public recordMetric(type: string, name: string, value: number, unit: string): void {
    const metric: PerformanceMetric = {
      type,
      name,
      value,
      unit,
      timestamp: Date.now(),
      pageUrl: window.location.href,
      sessionId: this.sessionId
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    this.persistMetric(metric);

    // Keep metrics array size manageable
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  private async persistMetric(metric: PerformanceMetric): Promise<void> {
    try {
      await window.ezsite.apis.tableCreate(37304, {
        metric_type: metric.type,
        metric_name: metric.name,
        value: metric.value,
        unit: metric.unit,
        page_url: metric.pageUrl,
        user_agent: navigator.userAgent,
        session_id: metric.sessionId,
        created_at: new Date(metric.timestamp).toISOString()
      });
    } catch (error) {
      console.warn('Failed to persist performance metric:', error);
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const key = `${metric.type}_${metric.name}`;
    const threshold = this.thresholds.get(key);
    
    if (!threshold || !threshold.enabled) return;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let thresholdValue = 0;
    
    if (metric.value >= threshold.criticalThreshold) {
      severity = 'critical';
      thresholdValue = threshold.criticalThreshold;
    } else if (metric.value >= threshold.warningThreshold) {
      severity = 'medium';
      thresholdValue = threshold.warningThreshold;
    } else {
      return; // No threshold exceeded
    }

    const alert: PerformanceAlert = {
      type: 'threshold_exceeded',
      metricType: metric.type,
      currentValue: metric.value,
      thresholdValue,
      severity,
      message: `${metric.type} ${metric.name} exceeded ${severity} threshold`,
      recommendations: this.getOptimizationRecommendations(metric.type, metric.name, metric.value),
      pageUrl: metric.pageUrl
    };

    this.handleAlert(alert);
  }

  private getOptimizationRecommendations(type: string, name: string, value: number): string[] {
    const recommendations: string[] = [];

    switch (`${type}_${name}`) {
      case 'load_time_page_load':
        recommendations.push('Optimize images and use modern formats (WebP, AVIF)');
        recommendations.push('Enable browser caching and compression');
        recommendations.push('Minimize JavaScript and CSS bundles');
        recommendations.push('Use code splitting and lazy loading');
        break;

      case 'load_time_first_contentful_paint':
        recommendations.push('Reduce server response time');
        recommendations.push('Optimize critical rendering path');
        recommendations.push('Inline critical CSS');
        recommendations.push('Preload important resources');
        break;

      case 'api_response_api_call':
        recommendations.push('Implement API response caching');
        recommendations.push('Optimize database queries');
        recommendations.push('Use pagination for large datasets');
        recommendations.push('Consider API response compression');
        break;

      case 'memory_heap_used':
        recommendations.push('Check for memory leaks in event listeners');
        recommendations.push('Properly dispose of unused objects');
        recommendations.push('Optimize image and data caching');
        recommendations.push('Use virtual scrolling for large lists');
        break;

      case 'interaction_click_response':
        recommendations.push('Optimize event handler performance');
        recommendations.push('Use requestAnimationFrame for animations');
        recommendations.push('Debounce frequent operations');
        recommendations.push('Consider using Web Workers for heavy tasks');
        break;

      default:
        recommendations.push('Monitor performance trends over time');
        recommendations.push('Profile the application for bottlenecks');
        break;
    }

    return recommendations;
  }

  private async handleAlert(alert: PerformanceAlert): Promise<void> {
    try {
      await window.ezsite.apis.tableCreate(37305, {
        alert_type: alert.type,
        metric_type: alert.metricType,
        current_value: alert.currentValue,
        threshold_value: alert.thresholdValue,
        severity: alert.severity,
        message: alert.message,
        recommendations: alert.recommendations.join('; '),
        page_url: alert.pageUrl,
        status: 'active',
        created_at: new Date().toISOString()
      });

      // Show toast notification for critical alerts
      if (alert.severity === 'critical') {
        this.showPerformanceAlert(alert);
      }
    } catch (error) {
      console.warn('Failed to persist performance alert:', error);
    }
  }

  private showPerformanceAlert(alert: PerformanceAlert): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PERFORMANCE_ALERT',
        alert: {
          title: `Performance Issue Detected`,
          body: alert.message,
          severity: alert.severity
        }
      });
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    this.metrics.forEach(metric => {
      const key = `${metric.type}_${metric.name}`;
      if (!summary[key]) {
        summary[key] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: -Infinity,
          unit: metric.unit
        };
      }
      
      summary[key].count++;
      summary[key].total += metric.value;
      summary[key].min = Math.min(summary[key].min, metric.value);
      summary[key].max = Math.max(summary[key].max, metric.value);
      summary[key].average = summary[key].total / summary[key].count;
    });

    return summary;
  }

  public getAPIMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    this.apiMetrics.forEach((durations, endpoint) => {
      summary[endpoint] = {
        count: durations.length,
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: this.calculatePercentile(durations, 95),
        p99: this.calculatePercentile(durations, 99)
      };
    });

    return summary;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  public updateThreshold(metricType: string, metricName: string, threshold: Partial<PerformanceThreshold>): void {
    const key = `${metricType}_${metricName}`;
    const existing = this.thresholds.get(key);
    
    if (existing) {
      this.thresholds.set(key, { ...existing, ...threshold });
    }
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
    
    this.metrics.length = 0;
    this.apiMetrics.clear();
  }
}

export default ComprehensivePerformanceMonitor;
