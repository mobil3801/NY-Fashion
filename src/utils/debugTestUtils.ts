
import { ApiError, normalizeError } from '@/lib/errors';

/**
 * Network testing utilities for debugging
 */

export interface NetworkTestResult {
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface BenchmarkResult {
  latency: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  bandwidth: {
    uploadMbps: number;
    downloadMbps: number;
  };
  reliability: {
    successRate: number;
    totalTests: number;
  };
}

/**
 * Simulate network failures for testing
 */
export class NetworkFailureSimulator {
  private originalFetch: typeof fetch;
  private isActive = false;
  private failureRate = 0;
  private delayMs = 0;

  constructor() {
    this.originalFetch = window.fetch;
  }

  /**
   * Start simulating network conditions
   */
  start(options: {
    failureRate?: number; // 0-1, percentage of requests to fail
    delayMs?: number; // Additional delay to add to requests
    condition?: 'slow' | 'offline' | 'intermittent';
  } = {}) {
    if (this.isActive) {
      this.stop();
    }

    const { failureRate = 0, delayMs = 0, condition } = options;

    // Set defaults based on condition
    switch (condition) {
      case 'slow':
        this.failureRate = 0;
        this.delayMs = 2000;
        break;
      case 'offline':
        this.failureRate = 1;
        this.delayMs = 0;
        break;
      case 'intermittent':
        this.failureRate = 0.3;
        this.delayMs = 500;
        break;
      default:
        this.failureRate = failureRate;
        this.delayMs = delayMs;
    }

    this.isActive = true;

    // Override fetch
    window.fetch = async (...args) => {
      // Add delay if specified
      if (this.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }

      // Simulate failure if specified
      if (this.failureRate > 0 && Math.random() < this.failureRate) {
        throw new Error('Simulated network failure');
      }

      // Call original fetch
      return this.originalFetch(...args);
    };

    console.log(`🔧 Network simulation started:`, {
      failureRate: this.failureRate,
      delayMs: this.delayMs,
      condition
    });
  }

  /**
   * Stop network simulation
   */
  stop() {
    if (!this.isActive) return;

    window.fetch = this.originalFetch;
    this.isActive = false;
    this.failureRate = 0;
    this.delayMs = 0;

    console.log('🔧 Network simulation stopped');
  }

  /**
   * Check if simulation is active
   */
  isSimulating(): boolean {
    return this.isActive;
  }
}

/**
 * Test a specific endpoint
 */
export async function testEndpoint(
url: string,
options: RequestInit = {})
: Promise<NetworkTestResult> {
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-cache'
    });

    const duration = performance.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        duration,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    }

    return {
      success: true,
      duration,
      details: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    const normalizedError = normalizeError(error);

    return {
      success: false,
      duration,
      error: normalizedError.message,
      details: normalizedError
    };
  }
}

/**
 * Run comprehensive network benchmark
 */
export async function runNetworkBenchmark(
options: {
  testCount?: number;
  testUrls?: string[];
  uploadTest?: boolean;
} = {})
: Promise<BenchmarkResult> {
  const {
    testCount = 10,
    testUrls = [`${window.location.origin}/favicon.ico`],
    uploadTest = false
  } = options;

  console.log('🚀 Starting network benchmark...');

  const latencyTests: number[] = [];
  const reliabilityTests: boolean[] = [];

  // Run latency tests
  for (let i = 0; i < testCount; i++) {
    const url = testUrls[i % testUrls.length];
    const result = await testEndpoint(url, { method: 'HEAD' });

    latencyTests.push(result.duration);
    reliabilityTests.push(result.success);

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Calculate latency metrics
  const sortedLatencies = [...latencyTests].sort((a, b) => a - b);
  const latency = {
    min: Math.min(...latencyTests),
    max: Math.max(...latencyTests),
    avg: latencyTests.reduce((sum, val) => sum + val, 0) / latencyTests.length,
    median: sortedLatencies[Math.floor(sortedLatencies.length / 2)]
  };

  // Calculate reliability
  const successfulTests = reliabilityTests.filter(Boolean).length;
  const reliability = {
    successRate: successfulTests / reliabilityTests.length,
    totalTests: reliabilityTests.length
  };

  // Bandwidth tests (simplified)
  let bandwidth = {
    uploadMbps: 0,
    downloadMbps: 0
  };

  try {
    // Simple download test
    const downloadStart = performance.now();
    const downloadResponse = await fetch(`${window.location.origin}/favicon.ico?${Date.now()}`, {
      cache: 'no-cache'
    });
    const downloadData = await downloadResponse.blob();
    const downloadDuration = performance.now() - downloadStart;
    const downloadSizeBytes = downloadData.size;
    bandwidth.downloadMbps = downloadSizeBytes * 8 / (downloadDuration / 1000) / (1024 * 1024);

    // Upload test (if enabled and supported)
    if (uploadTest) {
      try {
        const testData = new Blob(['x'.repeat(1024)], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('test', testData);

        const uploadStart = performance.now();
        await fetch('/api/test-upload', {
          method: 'POST',
          body: formData
        });
        const uploadDuration = performance.now() - uploadStart;
        bandwidth.uploadMbps = testData.size * 8 / (uploadDuration / 1000) / (1024 * 1024);
      } catch {
























        // Upload test failed, keep upload as 0
      }}} catch (error) {console.warn('Bandwidth test failed:', error);}const result: BenchmarkResult = { latency, bandwidth, reliability };console.log('📊 Benchmark completed:', result);return result;} /**
* Test DNS resolution speed
*/export async function testDnsResolution(domains: string[] = ['google.com', 'cloudflare.com']): Promise<{domain: string;resolved: boolean;duration: number;}[]> {const results = await Promise.allSettled(domains.map(async (domain) => {const startTime = performance.now();
        try {
          // Use image loading to test DNS resolution
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Even errors mean DNS resolved
            img.src = `https://${domain}/favicon.ico?${Date.now()}`;
            setTimeout(() => reject(new Error('Timeout')), 5000);
          });

          return {
            domain,
            resolved: true,
            duration: performance.now() - startTime
          };
        } catch {
          return {
            domain,
            resolved: false,
            duration: performance.now() - startTime
          };
        }
      })
  );

  return results.map((result, index) =>
  result.status === 'fulfilled' ?
  result.value :
  {
    domain: domains[index],
    resolved: false,
    duration: 0
  }
  );
}

/**
 * Create a network failure scenario for testing error handling
 */
export function createTestScenario(scenario: 'timeout' | 'network-error' | 'server-error' | 'abort') {
  return async (url: string, options: RequestInit = {}) => {
    switch (scenario) {
      case 'timeout':
        return new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 1000);
        });

      case 'network-error':
        throw new TypeError('Failed to fetch');

      case 'server-error':
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          json: async () => ({ error: 'Server error' })
        } as Response;

      case 'abort':
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        throw abortError;

      default:
        return fetch(url, options);
    }
  };
}

// Global instance for easy access
export const networkSimulator = new NetworkFailureSimulator();

// Export for debugging in console
if (typeof window !== 'undefined') {
  (window as any).debugUtils = {
    networkSimulator,
    testEndpoint,
    runNetworkBenchmark,
    testDnsResolution,
    createTestScenario
  };
}