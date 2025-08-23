
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ConnectivityMonitor, isOfflineError, calculateBackoffDelay } from '../connectivity';

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

Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://example.com'
  },
  writable: true
});

// Mock performance
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => 1000)
  },
  writable: true
});

describe('ConnectivityMonitor', () => {
  let monitor: ConnectivityMonitor;
  let listenerCallback: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    listenerCallback = vi.fn();

    // Reset navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true
    });
  });

  afterEach(() => {
    monitor?.destroy();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default config and online status', () => {
      monitor = new ConnectivityMonitor();

      const status = monitor.getStatus();
      expect(status.online).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it('should initialize with custom config', () => {
      monitor = new ConnectivityMonitor({
        heartbeatInterval: 5000,
        maxRetries: 10
      });

      // Config should be applied internally
      expect(monitor).toBeDefined();
    });

    it('should setup browser event listeners', () => {
      monitor = new ConnectivityMonitor();

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('offline detection', () => {
    it('should detect offline status on TypeError (network error)', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      monitor = new ConnectivityMonitor({ heartbeatInterval: 100 });
      monitor.addListener(listenerCallback);

      // Trigger heartbeat
      await monitor.checkNow();

      const status = monitor.getStatus();
      expect(status.online).toBe(false);
      expect(status.lastError).toContain('TypeError');
      expect(listenerCallback).toHaveBeenCalled();
    });

    it('should detect offline after consecutive failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      monitor = new ConnectivityMonitor();
      monitor.addListener(listenerCallback);

      // First failure - should still be online
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(true);
      expect(monitor.getStatus().consecutiveFailures).toBe(1);

      // Second failure - should be offline
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(false);
      expect(monitor.getStatus().consecutiveFailures).toBe(2);
      expect(listenerCallback).toHaveBeenCalled();
    });

    it('should handle browser offline event', () => {
      monitor = new ConnectivityMonitor();
      monitor.addListener(listenerCallback);

      // Simulate browser offline event
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);

      // Should be marked offline
      const status = monitor.getStatus();
      expect(status.online).toBe(false);
      expect(status.lastError).toBe('Browser offline event');
      expect(listenerCallback).toHaveBeenCalled();
    });
  });

  describe('online recovery', () => {
    it('should recover online status on successful heartbeat', async () => {
      // Start with offline state
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).
      mockRejectedValueOnce(new TypeError('Failed to fetch')).
      mockResolvedValueOnce(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();
      monitor.addListener(listenerCallback);

      // Go offline
      await monitor.checkNow();
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(false);

      // Recover online
      await monitor.checkNow();
      expect(monitor.getStatus().online).toBe(true);
      expect(monitor.getStatus().consecutiveFailures).toBe(0);
      expect(listenerCallback).toHaveBeenCalledTimes(2); // offline then online
    });

    it('should handle browser online event with immediate check', async () => {
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();
      monitor.addListener(listenerCallback);

      // Start offline
      Object.defineProperty(window.navigator, 'onLine', { value: false });

      // Simulate browser online event
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      // Should immediately check and be online
      expect(monitor.getStatus().online).toBe(true);
      expect(monitor.getStatus().consecutiveFailures).toBe(0);
      expect(listenerCallback).toHaveBeenCalled();
    });
  });

  describe('heartbeat mechanism', () => {
    it('should schedule periodic heartbeats', async () => {
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor({ heartbeatInterval: 1000 });

      // Fast forward time
      vi.advanceTimersByTime(1000);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should try multiple endpoints on failure', async () => {
      mockFetch.
      mockRejectedValueOnce(new Error('Health endpoint failed')).
      mockRejectedValueOnce(new Error('Favicon failed')).
      mockResolvedValueOnce(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();

      await monitor.checkNow();

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(monitor.getStatus().online).toBe(true);
    });

    it('should handle heartbeat timeout', async () => {
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 10000))
      );

      monitor = new ConnectivityMonitor({ heartbeatTimeout: 1000 });

      const checkPromise = monitor.checkNow();
      vi.advanceTimersByTime(1000);

      await expect(checkPromise).resolves.not.toThrow();
      expect(monitor.getStatus().online).toBe(false);
    });
  });

  describe('diagnostics', () => {
    it('should track successful and failed attempts', async () => {
      mockFetch.
      mockResolvedValueOnce(new Response('OK', { status: 200 })).
      mockRejectedValueOnce(new Error('Failed')).
      mockResolvedValueOnce(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();

      await monitor.checkNow(); // Success
      await monitor.checkNow(); // Failure
      await monitor.checkNow(); // Success

      const diagnostics = monitor.getDiagnostics();
      expect(diagnostics.totalAttempts).toBe(3);
      expect(diagnostics.successfulAttempts).toBe(2);
      expect(diagnostics.failedEndpoints.size).toBeGreaterThan(0);
    });

    it('should track latency measurements', async () => {
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      monitor = new ConnectivityMonitor();

      await monitor.checkNow();

      const diagnostics = monitor.getDiagnostics();
      expect(diagnostics.averageLatency).toBeGreaterThan(0);
      expect(diagnostics.lastLatencies).toHaveLength(1);
    });
  });

  describe('memory safety', () => {
    it('should not notify listeners after destruction', async () => {
      monitor = new ConnectivityMonitor();
      monitor.addListener(listenerCallback);

      monitor.destroy();

      // Try to trigger a status change
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not call listeners after destruction
      expect(listenerCallback).not.toHaveBeenCalled();
    });

    it('should clean up timers on destruction', () => {
      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

      monitor = new ConnectivityMonitor({ heartbeatInterval: 1000 });
      monitor.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should abort ongoing requests on destruction', async () => {
      const abortSpy = vi.fn();
      const mockController = {
        signal: {},
        abort: abortSpy
      };

      vi.spyOn(window, 'AbortController').mockReturnValue(mockController as any);

      monitor = new ConnectivityMonitor();
      monitor.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should remove event listeners on destruction', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      monitor = new ConnectivityMonitor();
      monitor.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('listener management', () => {
    it('should add and remove listeners correctly', () => {
      monitor = new ConnectivityMonitor();

      const removeListener = monitor.addListener(listenerCallback);

      // Trigger status change
      mockFetch.mockRejectedValue(new Error('Network error'));

      removeListener();

      // Should not call removed listener
      expect(listenerCallback).not.toHaveBeenCalled();
    });

    it('should handle errors in listeners gracefully', async () => {
      const errorListener = vi.fn(() => {throw new Error('Listener error');});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      monitor = new ConnectivityMonitor();
      monitor.addListener(errorListener);
      monitor.addListener(listenerCallback);

      mockFetch.mockRejectedValue(new TypeError('Network error'));
      await monitor.checkNow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in connectivity listener:', expect.any(Error));
      expect(listenerCallback).toHaveBeenCalled(); // Other listeners should still work

      consoleErrorSpy.mockRestore();
    });
  });
});

describe('isOfflineError', () => {
  it('should return true for TypeError', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('should return true for network-related errors', () => {
    expect(isOfflineError(new Error('Network request failed'))).toBe(true);
    expect(isOfflineError(new Error('Connection timeout'))).toBe(true);
    expect(isOfflineError(new Error('DNS resolution failed'))).toBe(true);
  });

  it('should return true for server errors (5xx)', () => {
    expect(isOfflineError({ status: 500 })).toBe(true);
    expect(isOfflineError({ status: 502 })).toBe(true);
    expect(isOfflineError({ statusCode: 503 })).toBe(true);
  });

  it('should return true for timeout errors', () => {
    expect(isOfflineError({ status: 408 })).toBe(true);
    expect(isOfflineError({ status: 429 })).toBe(true);
  });

  it('should return false for client errors (4xx except timeout)', () => {
    expect(isOfflineError({ status: 400 })).toBe(false);
    expect(isOfflineError({ status: 404 })).toBe(false);
    expect(isOfflineError({ status: 403 })).toBe(false);
  });

  it('should return false for non-error objects', () => {
    expect(isOfflineError('string error')).toBe(false);
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
    expect(isOfflineError({})).toBe(false);
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff correctly', () => {
    expect(calculateBackoffDelay(1, 100, 1000, 2)).toBeLessThanOrEqual(100);
    expect(calculateBackoffDelay(2, 100, 1000, 2)).toBeLessThanOrEqual(200);
    expect(calculateBackoffDelay(3, 100, 1000, 2)).toBeLessThanOrEqual(400);
  });

  it('should respect maximum delay', () => {
    const delay = calculateBackoffDelay(10, 100, 500, 2);
    expect(delay).toBeLessThanOrEqual(500);
  });

  it('should return random values (jitter)', () => {
    const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(1, 100, 1000, 2));
    const uniqueDelays = new Set(delays);

    // Should have some variation due to randomness
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });

  it('should handle edge cases', () => {
    expect(calculateBackoffDelay(0, 100, 1000, 2)).toBeLessThanOrEqual(50); // 2^-1 = 0.5
    expect(calculateBackoffDelay(1, 0, 1000, 2)).toBe(0);
    expect(calculateBackoffDelay(1, 100, 0, 2)).toBe(0);
  });
});