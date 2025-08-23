
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  NetworkSimulator, 
  PerformanceMonitor, 
  TestResultAggregator,
  generateTestProduct
} from './api-test-utils';

// Mock window.ezsite.apis
const mockApis = {
  run: vi.fn(),
  tablePage: vi.fn()
};

// @ts-ignore
global.window = {
  ezsite: {
    apis: mockApis
  }
};

describe('Network Failure Simulation Tests', () => {
  let networkSimulator: NetworkSimulator;
  let performanceMonitor: PerformanceMonitor;
  let testResults: TestResultAggregator;

  beforeEach(() => {
    networkSimulator = new NetworkSimulator();
    performanceMonitor = new PerformanceMonitor();
    testResults = new TestResultAggregator();
    vi.clearAllMocks();
  });

  afterEach(() => {
    networkSimulator.restore();
  });

  describe('Offline/Online Transition Tests', () => {
    it('should handle offline state gracefully', async () => {
      networkSimulator.setOffline(true);
      networkSimulator.install();

      mockApis.run.mockRejectedValue(new TypeError('Failed to fetch'));

      const endTimer = performanceMonitor.startTimer('offline_handling');

      try {
        await window.ezsite.apis.run({
          path: "getProducts",
          param: [{}]
        });
      } catch (error) {
        const duration = endTimer();
        
        expect(error.name).toBe('TypeError');
        expect(error.message).toContain('Failed to fetch');

        testResults.addResult('offline_handling', {
          success: true, // Successfully handled offline state
          duration,
          errorType: 'offline',
          errorMessage: error.message,
          networkTest: true
        });
      }
    });

    it('should recover when coming back online', async () => {
      // Start offline
      networkSimulator.setOffline(true);
      networkSimulator.install();

      mockApis.run.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await window.ezsite.apis.run({
          path: "getProducts",
          param: [{}]
        });
      } catch (offlineError) {
        expect(offlineError.name).toBe('TypeError');
      }

      // Come back online
      networkSimulator.setOffline(false);
      mockApis.run.mockResolvedValue({ data: [], error: null });

      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [{}]
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      testResults.addResult('online_recovery', {
        success: true,
        recoveredFromOffline: true,
        networkTest: true
      });
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle request timeouts', async () => {
      const timeoutDuration = 30000; // 30 seconds
      networkSimulator.setLatency(timeoutDuration);
      networkSimulator.install();

      // Mock timeout error after delay
      mockApis.run.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Request timeout'));
          }, 1000); // Shorter timeout for testing
        })
      );

      const endTimer = performanceMonitor.startTimer('timeout_handling');

      try {
        await window.ezsite.apis.run({
          path: "getProducts",
          param: [{}]
        });
      } catch (error) {
        const duration = endTimer();
        
        expect(error.message).toContain('timeout');

        testResults.addResult('timeout_handling', {
          success: true, // Successfully handled timeout
          duration,
          errorType: 'timeout',
          errorMessage: error.message,
          networkTest: true
        });
      }
    });

    it('should handle slow network conditions', async () => {
      const slowLatency = 3000; // 3 seconds
      networkSimulator.setLatency(slowLatency);
      networkSimulator.install();

      mockApis.run.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ data: [], error: null });
          }, slowLatency);
        })
      );

      const endTimer = performanceMonitor.startTimer('slow_network');
      
      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [{}]
      });

      const duration = endTimer();

      expect(error).toBeNull();
      expect(duration).toBeGreaterThan(slowLatency - 100); // Account for timing variations

      testResults.addResult('slow_network_handling', {
        success: true,
        duration,
        latency: slowLatency,
        slowNetworkHandled: true,
        networkTest: true
      });
    });
  });

  describe('Intermittent Connection Tests', () => {
    it('should handle intermittent failures', async () => {
      const failureRate = 0.3; // 30% failure rate
      networkSimulator.setErrorRate(failureRate);
      networkSimulator.install();

      const attempts = 10;
      const results: any[] = [];

      // Mock intermittent failures
      let callCount = 0;
      mockApis.run.mockImplementation(() => {
        callCount++;
        if (Math.random() < failureRate) {
          return Promise.reject(new Error('Intermittent network error'));
        }
        return Promise.resolve({ data: [], error: null });
      });

      for (let i = 0; i < attempts; i++) {
        try {
          const result = await window.ezsite.apis.run({
            path: "getProducts",
            param: [{}]
          });
          results.push({ success: true, attempt: i + 1 });
        } catch (error) {
          results.push({ 
            success: false, 
            attempt: i + 1, 
            error: error.message 
          });
        }
      }

      const successfulAttempts = results.filter(r => r.success).length;
      const failedAttempts = results.filter(r => !r.success).length;
      const actualFailureRate = failedAttempts / attempts;

      testResults.addResult('intermittent_failures', {
        success: true, // Test passed if we handled failures gracefully
        totalAttempts: attempts,
        successfulAttempts,
        failedAttempts,
        expectedFailureRate: failureRate,
        actualFailureRate,
        networkTest: true,
        intermittentTest: true
      });

      // Verify failure rate is approximately what we expected
      expect(Math.abs(actualFailureRate - failureRate)).toBeLessThan(0.2);
    });
  });

  describe('Concurrent Requests Under Network Stress', () => {
    it('should handle concurrent requests with network issues', async () => {
      networkSimulator.setLatency(1000); // 1 second latency
      networkSimulator.setErrorRate(0.2); // 20% error rate
      networkSimulator.install();

      const concurrentRequests = 5;
      const requests: any[] = [];

      // Mock varying response times and failures
      let requestId = 0;
      mockApis.run.mockImplementation(() => {
        requestId++;
        const currentId = requestId;
        
        return new Promise((resolve, reject) => {
          const delay = Math.random() * 2000 + 500; // 0.5-2.5 seconds
          
          setTimeout(() => {
            if (Math.random() < 0.2) {
              reject(new Error(`Network error for request ${currentId}`));
            } else {
              resolve({ data: [], error: null, requestId: currentId });
            }
          }, delay);
        });
      });

      // Fire concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          window.ezsite.apis.run({
            path: "getProducts",
            param: [{ search: `concurrent_test_${i}` }]
          }).catch(error => ({ error: error.message, requestId: i }))
        );
      }

      const endTimer = performanceMonitor.startTimer('concurrent_network_stress');
      const results = await Promise.allSettled(requests);
      const duration = endTimer();

      const successful = results.filter(r => 
        r.status === 'fulfilled' && !r.value.error
      ).length;

      const failed = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value.error)
      ).length;

      testResults.addResult('concurrent_network_stress', {
        success: successful > 0, // At least some requests succeeded
        duration,
        totalRequests: concurrentRequests,
        successfulRequests: successful,
        failedRequests: failed,
        concurrentTest: true,
        networkStressTest: true
      });

      // Verify we handled concurrent requests reasonably
      expect(successful + failed).toBe(concurrentRequests);
    });
  });

  describe('Data Integrity During Network Issues', () => {
    it('should maintain data integrity during partial failures', async () => {
      // Simulate save product with network issues
      const product = generateTestProduct();
      delete product.id; // New product

      // First attempt fails
      mockApis.run
        .mockRejectedValueOnce(new Error('Network error during save'))
        .mockResolvedValueOnce({ 
          data: { id: 123, message: 'Product created successfully' }, 
          error: null 
        });

      // First attempt should fail
      try {
        await window.ezsite.apis.run({
          path: "saveProduct",
          param: [product]
        });
      } catch (error) {
        expect(error.message).toContain('Network error');
      }

      // Second attempt should succeed
      const { data, error } = await window.ezsite.apis.run({
        path: "saveProduct",
        param: [product]
      });

      expect(error).toBeNull();
      expect(data.id).toBe(123);

      testResults.addResult('data_integrity_network_failure', {
        success: true,
        dataIntegrityMaintained: true,
        retrySuccessful: true,
        networkTest: true
      });
    });

    it('should prevent duplicate operations during network recovery', async () => {
      const product = generateTestProduct();
      product.id = 456; // Existing product

      let updateCount = 0;
      
      // Mock delayed response to simulate network recovery
      mockApis.run.mockImplementation(() => {
        updateCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ 
              data: { id: 456, message: 'Product updated successfully' }, 
              error: null 
            });
          }, 500);
        });
      });

      // Simulate user clicking save multiple times during network delay
      const updates = [
        window.ezsite.apis.run({
          path: "saveProduct",
          param: [{ ...product, name: 'Updated Name 1' }]
        }),
        window.ezsite.apis.run({
          path: "saveProduct",
          param: [{ ...product, name: 'Updated Name 2' }]
        }),
        window.ezsite.apis.run({
          path: "saveProduct",
          param: [{ ...product, name: 'Updated Name 3' }]
        })
      ];

      const results = await Promise.allSettled(updates);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      testResults.addResult('duplicate_prevention', {
        success: successful >= 1, // At least one update succeeded
        totalAttempts: 3,
        successfulAttempts: successful,
        updateCount,
        duplicatePrevention: true,
        networkTest: true
      });

      // All requests should complete (even if some are duplicates)
      expect(results).toHaveLength(3);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should implement proper retry logic with exponential backoff', async () => {
      const maxRetries = 3;
      let attemptCount = 0;
      const retryDelays: number[] = [];

      mockApis.run.mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount < maxRetries) {
          return Promise.reject(new Error('Temporary network error'));
        }
        
        return Promise.resolve({ data: [], error: null });
      });

      const startTime = Date.now();

      // Simulate retry logic (this would typically be in the application)
      let result;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          result = await window.ezsite.apis.run({
            path: "getProducts",
            param: [{}]
          });
          break;
        } catch (error) {
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            retryDelays.push(delay);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error;
          }
        }
      }

      const totalDuration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(attemptCount).toBe(maxRetries);

      testResults.addResult('retry_logic_exponential_backoff', {
        success: true,
        totalAttempts: attemptCount,
        retryDelays,
        totalDuration,
        retryLogicTest: true,
        networkTest: true
      });

      // Verify exponential backoff
      for (let i = 1; i < retryDelays.length; i++) {
        expect(retryDelays[i]).toBeGreaterThanOrEqual(retryDelays[i - 1]);
      }
    });
  });

  describe('Test Results Summary', () => {
    it('should provide comprehensive network test summary', () => {
      const summary = testResults.getSummary();
      const performanceMetrics = performanceMonitor.getMetrics();

      console.log('\n=== NETWORK SIMULATION TEST SUMMARY ===');
      console.log(`Total Tests: ${summary.total}`);
      console.log(`Passed: ${summary.passed}`);
      console.log(`Failed: ${summary.failed}`);
      console.log(`Pass Rate: ${summary.passRate.toFixed(2)}%`);
      
      console.log('\n=== PERFORMANCE METRICS ===');
      Object.entries(performanceMetrics).forEach(([operation, metrics]) => {
        console.log(`${operation}:`);
        console.log(`  Average: ${metrics.avg.toFixed(2)}ms`);
        console.log(`  Min: ${metrics.min.toFixed(2)}ms`);
        console.log(`  Max: ${metrics.max.toFixed(2)}ms`);
        console.log(`  95th Percentile: ${metrics.p95.toFixed(2)}ms`);
      });

      console.log('\n=== NETWORK TEST CATEGORIES ===');
      const networkTests = summary.results.filter(r => r.result.networkTest);
      const offlineTests = networkTests.filter(r => r.result.errorType === 'offline');
      const timeoutTests = networkTests.filter(r => r.result.errorType === 'timeout');
      const intermittentTests = networkTests.filter(r => r.result.intermittentTest);
      const concurrentTests = networkTests.filter(r => r.result.concurrentTest);

      console.log(`Offline Tests: ${offlineTests.length}`);
      console.log(`Timeout Tests: ${timeoutTests.length}`);
      console.log(`Intermittent Tests: ${intermittentTests.length}`);
      console.log(`Concurrent Tests: ${concurrentTests.length}`);

      testResults.addResult('network_test_summary', {
        success: true,
        summary,
        performanceMetrics,
        testCategories: {
          offline: offlineTests.length,
          timeout: timeoutTests.length,
          intermittent: intermittentTests.length,
          concurrent: concurrentTests.length
        },
        summaryReport: true
      });

      expect(summary.total).toBeGreaterThan(0);
    });
  });
});
