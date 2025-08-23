
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../performance-monitor';

// Mock performance APIs
const mockPerformanceObserver = vi.fn();
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance
});

Object.defineProperty(global, 'PerformanceObserver', {
  value: mockPerformanceObserver
});

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor?.destroy();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor.isEnabled()).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customMonitor = new PerformanceMonitor({
        enabled: false,
        bufferSize: 500,
        flushInterval: 10000
      });

      expect(customMonitor.isEnabled()).toBe(false);
      customMonitor.destroy();
    });

    it('should setup performance observers when supported', () => {
      mockPerformanceObserver.mockImplementation(function(callback) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      });

      const monitor = new PerformanceMonitor();
      
      // Performance observers should be set up
      expect(mockPerformanceObserver).toHaveBeenCalled();
      
      monitor.destroy();
    });
  });

  describe('metric collection', () => {
    it('should collect timing metrics', () => {
      const startTime = performanceMonitor.startTiming('test-operation');
      
      // Simulate some time passing
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1500);
      
      const duration = performanceMonitor.endTiming('test-operation', startTime);
      
      expect(duration).toBeGreaterThan(0);
      expect(mockPerformance.mark).toHaveBeenCalled();
    });

    it('should collect memory metrics when available', () => {
      // Mock memory API
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 100000000
        },
        configurable: true
      });

      const memoryMetrics = performanceMonitor.getMemoryMetrics();
      
      expect(memoryMetrics).toBeDefined();
      expect(memoryMetrics.usedJSHeapSize).toBe(10000000);
      expect(memoryMetrics.totalJSHeapSize).toBe(20000000);
    });

    it('should handle missing memory API gracefully', () => {
      // Remove memory API
      delete (performance as any).memory;
      
      const memoryMetrics = performanceMonitor.getMemoryMetrics();
      
      expect(memoryMetrics).toEqual({
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      });
    });

    it('should collect navigation timing metrics', () => {
      mockPerformance.getEntriesByType.mockReturnValue([{
        type: 'navigation',
        domContentLoadedEventEnd: 1500,
        loadEventEnd: 2000,
        responseEnd: 1000,
        fetchStart: 500
      }]);

      const navigationMetrics = performanceMonitor.getNavigationMetrics();
      
      expect(navigationMetrics).toBeDefined();
      expect(navigationMetrics.domContentLoaded).toBe(1000); // 1500 - 500
      expect(navigationMetrics.loadComplete).toBe(1500); // 2000 - 500
    });
  });

  describe('metric thresholds and alerts', () => {
    it('should detect performance issues when thresholds exceeded', () => {
      const alertCallback = vi.fn();
      performanceMonitor.onPerformanceIssue(alertCallback);

      // Record a slow operation
      performanceMonitor.recordMetric('slow-operation', 5000, {
        threshold: 1000,
        type: 'timing'
      });

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'threshold_exceeded',
          metric: 'slow-operation',
          value: 5000,
          threshold: 1000
        })
      );
    });

    it('should detect memory pressure', () => {
      const alertCallback = vi.fn();
      performanceMonitor.onPerformanceIssue(alertCallback);

      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 90000000,
          totalJSHeapSize: 95000000,
          jsHeapSizeLimit: 100000000
        },
        configurable: true
      });

      performanceMonitor.checkMemoryPressure();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory_pressure',
          severity: 'high'
        })
      );
    });

    it('should detect long tasks', () => {
      const alertCallback = vi.fn();
      performanceMonitor.onPerformanceIssue(alertCallback);

      // Simulate long task detection
      performanceMonitor.recordLongTask({
        duration: 100,
        startTime: 1000,
        entryType: 'longtask'
      });

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'long_task',
          duration: 100
        })
      );
    });
  });

  describe('performance reporting', () => {
    it('should generate comprehensive performance report', () => {
      // Record some metrics
      performanceMonitor.recordMetric('api-call', 500, { type: 'timing' });
      performanceMonitor.recordMetric('render-time', 16, { type: 'timing' });
      performanceMonitor.recordMetric('bundle-size', 1000000, { type: 'size' });

      const report = performanceMonitor.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('issues');
      expect(report.metrics.length).toBeGreaterThan(0);
    });

    it('should calculate performance scores', () => {
      // Set up mock navigation timing
      mockPerformance.getEntriesByType.mockReturnValue([{
        type: 'navigation',
        domContentLoadedEventEnd: 1000,
        loadEventEnd: 2000,
        firstPaint: 800,
        firstContentfulPaint: 1200
      }]);

      const score = performanceMonitor.calculatePerformanceScore();

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should track performance trends over time', () => {
      // Record metrics over time
      performanceMonitor.recordMetric('page-load', 1000);
      performanceMonitor.recordMetric('page-load', 1200);
      performanceMonitor.recordMetric('page-load', 900);

      const trends = performanceMonitor.getPerformanceTrends('page-load');

      expect(trends).toHaveProperty('average');
      expect(trends).toHaveProperty('trend'); // 'improving', 'degrading', or 'stable'
      expect(trends).toHaveProperty('samples');
      expect(trends.samples).toBe(3);
    });
  });

  describe('resource monitoring', () => {
    it('should monitor resource loading performance', () => {
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'https://example.com/api/data',
          entryType: 'resource',
          duration: 300,
          transferSize: 1024,
          responseEnd: 1300,
          responseStart: 1000
        }
      ]);

      const resourceMetrics = performanceMonitor.getResourceMetrics();

      expect(resourceMetrics).toHaveLength(1);
      expect(resourceMetrics[0]).toHaveProperty('url');
      expect(resourceMetrics[0]).toHaveProperty('duration');
      expect(resourceMetrics[0]).toHaveProperty('size');
      expect(resourceMetrics[0].duration).toBe(300);
    });

    it('should identify slow resources', () => {
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'https://example.com/slow-resource',
          entryType: 'resource',
          duration: 5000,
          transferSize: 1024
        }
      ]);

      const slowResources = performanceMonitor.getSlowResources(1000);

      expect(slowResources).toHaveLength(1);
      expect(slowResources[0].url).toContain('slow-resource');
      expect(slowResources[0].duration).toBe(5000);
    });
  });

  describe('user interaction monitoring', () => {
    it('should track user interaction responsiveness', () => {
      const interaction = {
        type: 'click',
        target: 'button',
        startTime: 1000,
        duration: 50
      };

      performanceMonitor.recordUserInteraction(interaction);

      const interactionMetrics = performanceMonitor.getInteractionMetrics();

      expect(interactionMetrics).toHaveProperty('totalInteractions');
      expect(interactionMetrics).toHaveProperty('averageResponseTime');
      expect(interactionMetrics.totalInteractions).toBe(1);
    });

    it('should detect slow interactions', () => {
      const alertCallback = vi.fn();
      performanceMonitor.onPerformanceIssue(alertCallback);

      const slowInteraction = {
        type: 'click',
        target: 'button',
        startTime: 1000,
        duration: 200 // Above threshold
      };

      performanceMonitor.recordUserInteraction(slowInteraction);

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'slow_interaction',
          interaction: 'click',
          duration: 200
        })
      );
    });
  });

  describe('data management', () => {
    it('should respect buffer size limits', () => {
      const smallBufferMonitor = new PerformanceMonitor({
        bufferSize: 5
      });

      // Add more metrics than buffer size
      for (let i = 0; i < 10; i++) {
        smallBufferMonitor.recordMetric(`metric-${i}`, i * 100);
      }

      const report = smallBufferMonitor.generateReport();
      expect(report.metrics.length).toBeLessThanOrEqual(5);

      smallBufferMonitor.destroy();
    });

    it('should periodically flush data', (done) => {
      const flushCallback = vi.fn();
      const quickFlushMonitor = new PerformanceMonitor({
        flushInterval: 100,
        onFlush: flushCallback
      });

      setTimeout(() => {
        expect(flushCallback).toHaveBeenCalled();
        quickFlushMonitor.destroy();
        done();
      }, 150);
    });

    it('should export/import performance data', () => {
      performanceMonitor.recordMetric('test-metric', 100);
      
      const exportedData = performanceMonitor.exportData();
      expect(exportedData).toHaveProperty('metrics');
      expect(exportedData).toHaveProperty('timestamp');

      const newMonitor = new PerformanceMonitor();
      newMonitor.importData(exportedData);
      
      const report = newMonitor.generateReport();
      expect(report.metrics.some(m => m.name === 'test-metric')).toBe(true);

      newMonitor.destroy();
    });
  });

  describe('integration with development tools', () => {
    it('should integrate with browser dev tools', () => {
      // Mock console.table for dev tools integration
      const mockConsoleTable = vi.fn();
      global.console.table = mockConsoleTable;

      performanceMonitor.recordMetric('dev-metric', 200);
      performanceMonitor.logToDevTools();

      expect(mockConsoleTable).toHaveBeenCalled();
    });

    it('should provide debug information', () => {
      const debugInfo = performanceMonitor.getDebugInfo();

      expect(debugInfo).toHaveProperty('isEnabled');
      expect(debugInfo).toHaveProperty('bufferSize');
      expect(debugInfo).toHaveProperty('metricsCount');
      expect(debugInfo).toHaveProperty('observersActive');
    });
  });

  describe('error handling', () => {
    it('should handle performance API errors gracefully', () => {
      // Mock performance.mark to throw
      mockPerformance.mark.mockImplementationOnce(() => {
        throw new Error('Performance API error');
      });

      expect(() => {
        performanceMonitor.startTiming('error-test');
      }).not.toThrow();
    });

    it('should continue working when observers fail', () => {
      mockPerformanceObserver.mockImplementation(() => {
        throw new Error('Observer creation failed');
      });

      expect(() => {
        new PerformanceMonitor();
      }).not.toThrow();
    });
  });
});
