
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectivityMonitor, isOfflineError, calculateBackoffDelay } from '../connectivity';

// Mock fetch and navigator
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockNavigator = {
  onLine: true,
};
Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

describe('ConnectivityMonitor', () => {
  let monitor: ConnectivityMonitor;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigator.onLine = true;
    monitor = new ConnectivityMonitor({
      heartbeatInterval: 100, // Fast for testing
      heartbeatTimeout: 50,
    });
  });

  afterEach(() => {
    monitor?.destroy();
  });

  it('should initialize with online status', () => {
    const status = monitor.getStatus();
    expect(status.online).toBe(true);
    expect(status.consecutiveFailures).toBe(0);
  });

  it('should detect offline status after failures', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network error'));
    
    const statusPromise = new Promise((resolve) => {
      monitor.addListener((status) => {
        if (!status.online) {
          resolve(status);
        }
      });
    });

    await monitor.checkNow();
    await monitor.checkNow(); // Second failure should mark offline

    const status = await statusPromise;
    expect(status.online).toBe(false);
  });

  it('should recover when network is restored', async () => {
    // First, go offline
    mockFetch.mockRejectedValue(new TypeError('Network error'));
    await monitor.checkNow();
    await monitor.checkNow();

    // Then recover
    mockFetch.mockResolvedValue(new Response('', { status: 200 }));
    
    const statusPromise = new Promise((resolve) => {
      monitor.addListener((status) => {
        if (status.online && status.consecutiveFailures === 0) {
          resolve(status);
        }
      });
    });

    await monitor.checkNow();
    const status = await statusPromise;
    expect(status.online).toBe(true);
  });

  it('should handle browser online/offline events', () => {
    const onlineEvent = new Event('online');
    const offlineEvent = new Event('offline');

    window.dispatchEvent(offlineEvent);
    expect(monitor.getStatus().online).toBe(false);

    window.dispatchEvent(onlineEvent);
    expect(monitor.getStatus().online).toBe(true);
  });

  it('should clean up properly when destroyed', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    monitor.destroy();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

describe('isOfflineError', () => {
  it('should identify network errors', () => {
    expect(isOfflineError(new TypeError('Network error'))).toBe(true);
    expect(isOfflineError(new Error('Connection timeout'))).toBe(true);
    expect(isOfflineError(new Error('DNS resolution failed'))).toBe(true);
  });

  it('should identify HTTP errors as offline', () => {
    expect(isOfflineError({ status: 408 })).toBe(true);
    expect(isOfflineError({ status: 500 })).toBe(true);
    expect(isOfflineError({ status: 503 })).toBe(true);
  });

  it('should not identify client errors as offline', () => {
    expect(isOfflineError({ status: 404 })).toBe(false);
    expect(isOfflineError({ status: 401 })).toBe(false);
    expect(isOfflineError(new Error('Validation error'))).toBe(false);
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff', () => {
    expect(calculateBackoffDelay(0, 100, 1000, 2)).toBeCloseTo(100, -1);
    expect(calculateBackoffDelay(1, 100, 1000, 2)).toBeCloseTo(200, -1);
    expect(calculateBackoffDelay(2, 100, 1000, 2)).toBeCloseTo(400, -1);
  });

  it('should cap at max delay', () => {
    const delay = calculateBackoffDelay(10, 100, 1000, 2);
    expect(delay).toBeLessThanOrEqual(1000 * 1.25); // Max + 25% jitter
  });

  it('should add jitter', () => {
    const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(1, 100, 1000, 2));
    const allSame = delays.every(delay => delay === delays[0]);
    expect(allSame).toBe(false); // Should have some variation due to jitter
  });
});
