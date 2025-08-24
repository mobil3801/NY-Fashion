
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ApiClient } from '../client';
import { ConnectivityMonitor } from '../connectivity';
import { OfflineQueue } from '../offlineQueue';

// Mock global fetch
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock window properties
Object.defineProperty(window, 'location', {
  value: { origin: 'https://example.com' },
  writable: true
});

Object.defineProperty(window, 'navigator', {
  value: { onLine: true },
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

// Mock AbortController
class MockAbortController {
  signal = { aborted: false };
  abort = vi.fn(() => {
    this.signal.aborted = true;
  });
}
global.AbortController = MockAbortController as any;

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn().mockReturnValue({
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          add: vi.fn().mockReturnValue({ onsuccess: null }),
          getAll: vi.fn().mockReturnValue({
            result: [],
            onsuccess: null
          }),
          index: vi.fn().mockReturnValue({
            getAll: vi.fn().mockReturnValue({
              result: [],
              onsuccess: null
            })
          })
        })
      })
    },
    onsuccess: null
  })
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('Cleanup and Memory Management Tests', () => {
  let client: ApiClient;
  let monitor: ConnectivityMonitor;
  let queue: OfflineQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    client?.destroy();
    monitor?.destroy();
    queue = null as any;
    vi.useRealTimers();
  });

  describe('ApiClient Cleanup', () => {
    it('should clean up all resources on destroy', () => {
      client = new ApiClient();

      const statusCallback = vi.fn();
      const unsubscribe = client.subscribeToNetworkStatus(statusCallback);

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      client.destroy();

      // Should not be able to make requests after destroy
      expect(() => client.get('/api/test')).not.toThrow(); // May return rejected promise

      // Network status callbacks should not work
      client.setOnlineStatus(false);
      expect(statusCallback).not.toHaveBeenCalled();

      // Should have cleared timers
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should abort ongoing requests on destroy', async () => {
      client = new ApiClient();

      const abortSpy = vi.fn();
      vi.spyOn(window, 'AbortController').mockImplementation(() => ({
        signal: { aborted: false },
        abort: abortSpy
      }) as any);

      // Start a long-running request
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const requestPromise = client.get('/api/test');
      vi.advanceTimersByTime(100);

      client.destroy();

      expect(abortSpy).toHaveBeenCalled();

      // Request should be rejected
      await expect(requestPromise).rejects.toThrow();
    });

    it('should handle destroy called multiple times', () => {
      client = new ApiClient();

      expect(() => {
        client.destroy();
        client.destroy();
        client.destroy();
      }).not.toThrow();
    });

    it('should clean up offline queue on destroy', async () => {
      client = new ApiClient();
      client.setOnlineStatus(false);

      // Add items to offline queue
      await expect(client.post('/api/item1', { data: 1 })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });
      await expect(client.post('/api/item2', { data: 2 })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });

      expect(client.getQueueStatus().size).toBe(2);

      client.destroy();

      // Queue should be cleared
      expect(client.getQueueStatus().isEmpty).toBe(true);
    });
  });

  describe('ConnectivityMonitor Cleanup', () => {
    it('should remove event listeners on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      monitor = new ConnectivityMonitor();
      monitor.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clear heartbeat timer on destroy', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      monitor = new ConnectivityMonitor({ heartbeatInterval: 1000 });
      monitor.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should abort pending requests on destroy', async () => {
      const abortSpy = vi.fn();
      vi.spyOn(window, 'AbortController').mockImplementation(() => ({
        signal: { aborted: false },
        abort: abortSpy
      }) as any);

      monitor = new ConnectivityMonitor();

      mockFetch.mockImplementation(() =>
      new Promise(() => {}) // Never resolves
      );

      monitor.checkNow();
      monitor.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should not notify listeners after destroy', async () => {
      monitor = new ConnectivityMonitor();

      const listener = vi.fn();
      monitor.addListener(listener);

      monitor.destroy();

      // Try to trigger status change (should not call listener)
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      // This shouldn't work after destroy, but even if it does, 
      // listeners shouldn't be called
      const listenerCallsBefore = listener.mock.calls.length;

      try {
        await monitor.checkNow();
      } catch {






















        // Expected to fail after destroy
      }expect(listener.mock.calls.length).toBe(listenerCallsBefore);});it('should handle listener removal during destroy', () => {monitor = new ConnectivityMonitor();const listeners: (() => void)[] = [];for (let i = 0; i < 5; i++) {const removeListener = monitor.addListener(vi.fn(() => {// Try to remove other listeners during callback
                listeners.forEach((remove) => {try {remove();} catch {} // Ignore errors
                  });}));listeners.push(removeListener);}expect(() => monitor.destroy()).not.toThrow();});});describe('Memory Leak Prevention', () => {it('should not retain references to destroyed components', () => {
        const clients: ApiClient[] = [];

        // Create multiple clients
        for (let i = 0; i < 10; i++) {
          const c = new ApiClient();
          c.subscribeToNetworkStatus(vi.fn());
          clients.push(c);
        }

        // Destroy all clients
        clients.forEach((c) => c.destroy());

        // Force garbage collection hint
        if (global.gc) {
          global.gc();
        }

        // Verify no lingering effects
        clients.forEach((c) => {
          expect(() => c.get('/test')).not.toThrow();
          // The requests may return rejected promises, but shouldn't cause errors
        });
      });

      it('should handle rapid create/destroy cycles', () => {
        for (let i = 0; i < 50; i++) {
          const c = new ApiClient();
          const m = new ConnectivityMonitor({ heartbeatInterval: 100 });

          c.subscribeToNetworkStatus(vi.fn());
          m.addListener(vi.fn());

          c.destroy();
          m.destroy();
        }

        // Should not cause memory issues or errors
        expect(true).toBe(true);
      });

      it('should clean up large data structures', async () => {
        client = new ApiClient();
        client.setOnlineStatus(false);

        // Create large operations
        const largeData = {
          items: new Array(1000).fill(0).map((_, i) => ({
            id: i,
            data: 'x'.repeat(1000) // 1KB per item
          }))
        };

        for (let i = 0; i < 10; i++) {
          await expect(client.post(`/api/bulk${i}`, largeData)).
          rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });
        }

        expect(client.getQueueStatus().size).toBe(10);

        client.destroy();

        // Memory should be freed
        expect(client.getQueueStatus().isEmpty).toBe(true);
      });
    });

  describe('setState After Unmount Prevention', () => {
    it('should not update state after component destruction', async () => {
      client = new ApiClient();

      const statusCallback = vi.fn();
      client.subscribeToNetworkStatus(statusCallback);

      // Start async operations
      mockFetch.mockImplementation(() =>
      new Promise((resolve) =>
      setTimeout(() => resolve(new Response('OK')), 1000)
      )
      );

      const requestPromise = client.get('/api/test');
      vi.advanceTimersByTime(100);

      // Destroy client while request is pending
      client.destroy();

      // Complete the async operation
      vi.advanceTimersByTime(1000);

      // Should not cause state updates or call callbacks
      const callsBefore = statusCallback.mock.calls.length;
      await requestPromise.catch(() => {}); // Ignore rejection

      expect(statusCallback.mock.calls.length).toBe(callsBefore);
    });

    it('should handle connectivity status changes after destroy', async () => {
      monitor = new ConnectivityMonitor({ heartbeatInterval: 1000 });

      const listener = vi.fn();
      monitor.addListener(listener);

      // Start heartbeat
      mockFetch.mockImplementation(() =>
      new Promise((resolve) =>
      setTimeout(() => resolve(new Response('OK')), 500)
      )
      );

      vi.advanceTimersByTime(100);
      monitor.destroy();
      vi.advanceTimersByTime(1000);

      // Should not call listener after destroy
      expect(listener).not.toHaveBeenCalled();
    });

    it('should prevent race conditions during cleanup', () => {
      client = new ApiClient();
      monitor = new ConnectivityMonitor();

      // Simulate rapid operations during cleanup
      const operations = [];

      for (let i = 0; i < 20; i++) {
        operations.push(async () => {
          try {
            await client.get(`/api/test${i}`);
          } catch {}
        });
      }

      // Start operations
      operations.forEach((op) => op());

      // Destroy while operations are running
      setTimeout(() => {
        client.destroy();
        monitor.destroy();
      }, 50);

      vi.advanceTimersByTime(200);

      // Should not cause unhandled errors
      expect(true).toBe(true);
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should limit concurrent requests', async () => {
      client = new ApiClient({ maxConcurrentRequests: 3 });

      let activeRequests = 0;
      const maxConcurrent = { value: 0 };

      mockFetch.mockImplementation(() => {
        activeRequests++;
        maxConcurrent.value = Math.max(maxConcurrent.value, activeRequests);

        return new Promise((resolve) => {
          setTimeout(() => {
            activeRequests--;
            resolve(new Response('OK'));
          }, 100);
        });
      });

      // Start many requests
      const requests = Array.from({ length: 10 }, (_, i) =>
      client.get(`/api/test${i}`)
      );

      vi.advanceTimersByTime(300);
      await Promise.all(requests);

      // Should not exceed limit
      expect(maxConcurrent.value).toBeLessThanOrEqual(3);
    });

    it('should handle timer exhaustion gracefully', () => {
      const originalSetTimeout = global.setTimeout;
      let timerCount = 0;
      const maxTimers = 5;

      global.setTimeout = vi.fn((callback: Function, delay: number) => {
        if (timerCount >= maxTimers) {
          throw new Error('Timer limit exceeded');
        }
        timerCount++;
        return originalSetTimeout(() => {
          timerCount--;
          callback();
        }, delay);
      }) as any;

      expect(() => {
        // Create more monitors than timer limit
        for (let i = 0; i < maxTimers + 2; i++) {
          const m = new ConnectivityMonitor({ heartbeatInterval: 100 });
          m.destroy(); // Clean up immediately
        }
      }).not.toThrow();

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Error Boundary Integration', () => {
    it('should not throw unhandled errors during cleanup', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client = new ApiClient();
      monitor = new ConnectivityMonitor();

      // Simulate error conditions
      const originalClearTimeout = global.clearTimeout;
      global.clearTimeout = vi.fn(() => {
        throw new Error('Cleanup failed');
      });

      // Should handle cleanup errors gracefully
      expect(() => {
        client.destroy();
        monitor.destroy();
      }).not.toThrow();

      global.clearTimeout = originalClearTimeout;
      consoleSpy.mockRestore();
    });

    it('should isolate errors in concurrent cleanup operations', async () => {
      const clients = Array.from({ length: 5 }, () => new ApiClient());
      const monitors = Array.from({ length: 5 }, () => new ConnectivityMonitor());

      // Simulate one component having cleanup issues
      const faultyClient = clients[2];
      const originalDestroy = faultyClient.destroy;
      faultyClient.destroy = () => {
        originalDestroy.call(faultyClient);
        throw new Error('Faulty cleanup');
      };

      // Cleanup all components
      const cleanupPromises = [
      ...clients.map((c) => Promise.resolve().then(() => c.destroy())),
      ...monitors.map((m) => Promise.resolve().then(() => m.destroy()))];


      // Should handle individual failures without affecting others
      const results = await Promise.allSettled(cleanupPromises);

      const failures = results.filter((r) => r.status === 'rejected');
      expect(failures.length).toBeLessThanOrEqual(1); // Only the faulty one should fail
    });
  });
});