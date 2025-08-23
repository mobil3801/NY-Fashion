
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ConnectivityMonitor, isOfflineError, calculateBackoffDelay, createConnectivity } from '../connectivity';

// Mock global fetch
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock window properties
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true
  },
  writable: true
});

Object.defineProperty(window, 'addEventListener', {
  value: vi.fn(),
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: vi.fn(),
  writable: true
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true
});

Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://example.com'
  },
  writable: true
});

Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => 1000)
  },
  writable: true
});

describe('Enhanced Connectivity Tests', () => {
  let monitor: ConnectivityMonitor;
  let statusCallback: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    statusCallback = vi.fn();

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true
    });
  });

  afterEach(() => {
    monitor?.destroy();
    vi.useRealTimers();
  });

  describe('Network Flapping Detection', () => {
    it('should handle rapid online/offline transitions without race conditions', async () => {
      monitor = new ConnectivityMonitor({ heartbeatInterval: 100 });
      monitor.addListener(statusCallback);

      // Simulate rapid network flapping
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      // Go offline
      await monitor.checkNow();
      await monitor.checkNow(); // Second failure triggers offline
      expect(monitor.getStatus().online).toBe(false);

      // Rapid recovery and failure
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(true);

      // Immediate failure again
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
      await monitor.checkNow();
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(false);

      // Should have been called for each state change
      expect(statusCallback).toHaveBeenCalledTimes(3); // offline, online, offline
    });

    it('should debounce rapid status changes', async () => {
      monitor = new ConnectivityMonitor({
        heartbeatInterval: 100,
        consecutiveFailureThreshold: 1 // More sensitive for testing
      });
      monitor.addListener(statusCallback);

      // Simulate multiple rapid failures
      mockFetch.
      mockRejectedValueOnce(new TypeError('Network error')).
      mockRejectedValueOnce(new TypeError('Network error')).
      mockRejectedValueOnce(new TypeError('Network error'));

      await monitor.checkNow();
      await monitor.checkNow();
      await monitor.checkNow();

      // Should only trigger offline once despite multiple failures
      expect(statusCallback).toHaveBeenCalledTimes(1);
      expect(statusCallback).toHaveBeenCalledWith(expect.objectContaining({
        online: false
      }));
    });

    it('should handle browser online/offline events during heartbeat checks', async () => {
      monitor = new ConnectivityMonitor({ heartbeatInterval: 1000 });
      monitor.addListener(statusCallback);

      // Start a heartbeat check that will fail
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve(new Response('OK', { status: 200 })), 2000))
      );

      const checkPromise = monitor.checkNow();

      // While check is pending, browser reports offline
      Object.defineProperty(window.navigator, 'onLine', { value: false });
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);

      // Complete the heartbeat check
      vi.advanceTimersByTime(2000);
      await checkPromise;

      // Should be offline due to browser event, not heartbeat result
      expect(monitor.getStatus().online).toBe(false);
      expect(monitor.getStatus().lastError).toBe('Browser offline event');
    });
  });

  describe('Enhanced Error Classification', () => {
    it('should classify DNS resolution failures as offline errors', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
      expect(isOfflineError(dnsError)).toBe(true);
    });

    it('should classify connection refused as offline error', () => {
      const connRefusedError = new Error('connect ECONNREFUSED 127.0.0.1:443');
      expect(isOfflineError(connRefusedError)).toBe(true);
    });

    it('should classify certificate errors as non-offline errors', () => {
      const certError = new Error('certificate has expired');
      expect(isOfflineError(certError)).toBe(false);
    });

    it('should handle mixed error scenarios correctly', async () => {
      monitor = new ConnectivityMonitor();
      monitor.addListener(statusCallback);

      // Start with cert error (not offline)
      mockFetch.mockRejectedValueOnce(new Error('certificate verify failed'));
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(true); // Still online

      // Then network error (should trigger offline after threshold)
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(true); // First failure

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(false); // Second consecutive failure
    });
  });

  describe('Endpoint Fallback Strategy', () => {
    it('should try all configured endpoints before marking offline', async () => {
      const endpoints = ['/health', '/favicon.ico', '/robots.txt'];
      monitor = new ConnectivityMonitor({
        endpoints: endpoints.map((path) => ({ path, timeout: 1000 }))
      });

      // Make all endpoints fail except the last one
      mockFetch.
      mockRejectedValueOnce(new Error('Health endpoint failed')).
      mockRejectedValueOnce(new Error('Favicon failed')).
      mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await monitor.checkNow();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(monitor.getStatus().online).toBe(true);
    });

    it('should track per-endpoint failure rates', async () => {
      monitor = new ConnectivityMonitor();

      // Fail health endpoint, succeed with favicon
      mockFetch.
      mockRejectedValueOnce(new Error('Health endpoint failed')).
      mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await monitor.checkNow();

      const diagnostics = monitor.getDiagnostics();
      expect(diagnostics.failedEndpoints.size).toBeGreaterThan(0);
      expect(Array.from(diagnostics.failedEndpoints.keys())).toContain('/health');
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should not leak memory after multiple destroy/recreate cycles', () => {
      const monitors: ConnectivityMonitor[] = [];

      // Create and destroy multiple monitors
      for (let i = 0; i < 10; i++) {
        const m = new ConnectivityMonitor({ heartbeatInterval: 100 });
        monitors.push(m);
        m.addListener(statusCallback);
        m.destroy();
      }

      // All should be destroyed properly
      monitors.forEach((m) => {
        expect(() => m.checkNow()).not.toThrow();
      });
    });

    it('should handle listener removal during status updates', async () => {
      monitor = new ConnectivityMonitor();

      let removalCallback: (() => void) | null = null;
      const removingListener = vi.fn(() => {
        if (removalCallback) {
          removalCallback();
          removalCallback = null;
        }
      });

      removalCallback = monitor.addListener(removingListener);
      monitor.addListener(statusCallback);

      // Trigger status change
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
      await monitor.checkNow();
      await monitor.checkNow();

      // Both listeners should have been called, even though one removed itself
      expect(removingListener).toHaveBeenCalledTimes(1);
      expect(statusCallback).toHaveBeenCalledTimes(1);
    });

    it('should abort ongoing requests on destroy', async () => {
      const abortSpy = vi.fn();
      const mockController = {
        signal: { aborted: false },
        abort: abortSpy
      };

      vi.spyOn(window, 'AbortController').mockReturnValue(mockController as any);

      monitor = new ConnectivityMonitor();

      // Start a long request
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 10000))
      );

      monitor.checkNow();
      monitor.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('Latency Tracking', () => {
    it('should track response latencies accurately', async () => {
      let responseTime = 0;
      vi.spyOn(window.performance, 'now').
      mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1250); // End time (250ms later)

      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();
      await monitor.checkNow();

      const diagnostics = monitor.getDiagnostics();
      expect(diagnostics.averageLatency).toBe(250);
      expect(diagnostics.lastLatencies[0]).toBe(250);
    });

    it('should maintain latency history within limits', async () => {
      monitor = new ConnectivityMonitor();

      // Generate multiple responses with different latencies
      for (let i = 0; i < 15; i++) {
        vi.spyOn(window.performance, 'now').
        mockReturnValueOnce(1000).
        mockReturnValueOnce(1000 + i * 10);

        mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
        await monitor.checkNow();
      }

      const diagnostics = monitor.getDiagnostics();
      expect(diagnostics.lastLatencies.length).toBeLessThanOrEqual(10); // Should cap at 10
      expect(diagnostics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle zero heartbeat interval gracefully', () => {
      expect(() => {
        monitor = new ConnectivityMonitor({ heartbeatInterval: 0 });
      }).not.toThrow();
    });

    it('should handle very short timeouts', async () => {
      monitor = new ConnectivityMonitor({ heartbeatTimeout: 1 });

      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve(new Response('OK')), 100))
      );

      await monitor.checkNow();

      // Should timeout and be marked as offline
      expect(monitor.getStatus().online).toBe(false);
    });

    it('should handle empty endpoints array', () => {
      expect(() => {
        monitor = new ConnectivityMonitor({ endpoints: [] });
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous checkNow() calls', async () => {
      monitor = new ConnectivityMonitor();

      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      // Start multiple checks simultaneously
      const checks = Array.from({ length: 5 }, () => monitor.checkNow());
      await Promise.all(checks);

      // Should not cause issues or duplicate requests per endpoint
      expect(mockFetch).toHaveBeenCalled();
      expect(monitor.getStatus().online).toBe(true);
    });

    it('should handle listener addition during status updates', async () => {
      monitor = new ConnectivityMonitor();
      monitor.addListener(statusCallback);

      const lateListener = vi.fn();

      // Add listener during status change callback
      statusCallback.mockImplementation(() => {
        monitor.addListener(lateListener);
      });

      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
      await monitor.checkNow();
      await monitor.checkNow();

      expect(statusCallback).toHaveBeenCalled();
      // Late listener should not receive the current update but will receive future ones
      expect(lateListener).not.toHaveBeenCalled();
    });
  });

  describe('createConnectivity Factory', () => {
    it('should create connectivity monitor with default config', () => {
      const connectivity = createConnectivity();
      expect(connectivity).toBeInstanceOf(ConnectivityMonitor);
      connectivity.destroy();
    });

    it('should create connectivity monitor with custom config', () => {
      const connectivity = createConnectivity({
        heartbeatInterval: 5000,
        maxRetries: 5
      });
      expect(connectivity).toBeInstanceOf(ConnectivityMonitor);
      connectivity.destroy();
    });

    it('should handle invalid config gracefully', () => {
      expect(() => {
        const connectivity = createConnectivity({
          heartbeatInterval: -1,
          maxRetries: -1
        });
        connectivity.destroy();
      }).not.toThrow();
    });
  });
});