
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ApiClient } from '../client';

// Mock global fetch
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock window properties
Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://example.com'
  },
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

describe('Retry Scheduler Tests', () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new ApiClient({ retries: 3, retryDelay: 100 });
  });

  afterEach(() => {
    client?.destroy();
    vi.useRealTimers();
  });

  describe('Pause/Resume Behavior', () => {
    it('should pause retry operations when offline', async () => {
      // Start online
      client.setOnlineStatus(true);
      
      // Setup failing then succeeding requests
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(new Response('{"success": true}', { 
          status: 200, 
          headers: { 'content-type': 'application/json' } 
        }));

      const requestPromise = client.get('/api/test');
      
      // Let first retry start
      vi.advanceTimersByTime(50);
      
      // Go offline before retry completes
      client.setOnlineStatus(false);
      
      // Advance past retry delay
      vi.advanceTimersByTime(200);
      
      // Request should fail with offline error, not continue retrying
      await expect(requestPromise).rejects.toMatchObject({
        code: 'NETWORK_OFFLINE'
      });
      
      // Should have only made initial request, no retries while offline
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should resume retries when back online', async () => {
      client.setOnlineStatus(false);
      
      mockFetch.mockRejectedValue(new TypeError('Network error'));
      
      const requestPromise = client.get('/api/test');
      
      await expect(requestPromise).rejects.toMatchObject({
        code: 'NETWORK_OFFLINE'
      });
      
      // No retries should have occurred while offline
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Go back online
      client.setOnlineStatus(true);
      
      // Start a new request that should retry
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(new Response('{"success": true}', { 
          status: 200,
          headers: { 'content-type': 'application/json' } 
        }));
      
      const retryPromise = client.get('/api/test-retry');
      vi.advanceTimersByTime(500);
      
      const result = await retryPromise;
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 failed + 1 failed + 1 success
    });

    it('should handle online/offline transitions during active retries', async () => {
      client.setOnlineStatus(true);
      
      let requestCount = 0;
      mockFetch.mockImplementation(() => {
        requestCount++;
        if (requestCount <= 2) {
          return Promise.reject(new TypeError('Network error'));
        }
        return Promise.resolve(new Response('{"success": true}', { 
          status: 200,
          headers: { 'content-type': 'application/json' } 
        }));
      });

      const requestPromise = client.get('/api/test');
      
      // Let first request fail and start retry
      vi.advanceTimersByTime(50);
      
      // Go offline during retry delay
      client.setOnlineStatus(false);
      vi.advanceTimersByTime(100);
      
      // Go back online
      client.setOnlineStatus(true);
      vi.advanceTimersByTime(200);
      
      const result = await requestPromise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('Exponential Backoff with Jitter', () => {
    it('should increase delay exponentially with jitter', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = vi.fn((callback: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      }) as any;

      mockFetch.mockRejectedValue(new Error('Temporary failure'));
      
      const requestPromise = client.get('/api/test');
      vi.advanceTimersByTime(1000);
      
      await expect(requestPromise).rejects.toThrow();
      
      // Should have delays that increase (with some jitter)
      expect(delays.length).toBeGreaterThanOrEqual(2);
      expect(delays[1]).toBeGreaterThan(delays[0] * 0.5); // At least some backoff
      
      global.setTimeout = originalSetTimeout;
    });

    it('should respect maximum retry delay', async () => {
      const maxDelayClient = new ApiClient({ 
        retries: 5, 
        retryDelay: 100, 
        maxRetryDelay: 500 
      });
      
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = vi.fn((callback: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      mockFetch.mockRejectedValue(new Error('Temporary failure'));
      
      const requestPromise = maxDelayClient.get('/api/test');
      vi.advanceTimersByTime(2000);
      
      await expect(requestPromise).rejects.toThrow();
      
      // All delays should be <= maxRetryDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(500);
      });
      
      maxDelayClient.destroy();
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Retry Abort Scenarios', () => {
    it('should abort retries when request timeout is reached', async () => {
      const timeoutClient = new ApiClient({ 
        timeout: 1000, 
        retries: 3, 
        retryDelay: 500 
      });
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );
      
      const requestPromise = timeoutClient.get('/api/test');
      vi.advanceTimersByTime(1000);
      
      await expect(requestPromise).rejects.toMatchObject({
        code: 'TIMEOUT'
      });
      
      timeoutClient.destroy();
    });

    it('should abort retries when client is destroyed', async () => {
      mockFetch.mockRejectedValue(new Error('Temporary failure'));
      
      const requestPromise = client.get('/api/test');
      vi.advanceTimersByTime(50);
      
      client.destroy();
      vi.advanceTimersByTime(500);
      
      await expect(requestPromise).rejects.toThrow();
    });

    it('should handle abort controller failures gracefully', async () => {
      const faultyController = {
        signal: { aborted: false },
        abort: vi.fn(() => {
          throw new Error('Abort failed');
        })
      };
      
      vi.spyOn(window, 'AbortController').mockReturnValue(faultyController as any);
      
      mockFetch.mockRejectedValue(new Error('Temporary failure'));
      
      const requestPromise = client.get('/api/test');
      
      // Should still work despite abort controller issues
      await expect(requestPromise).rejects.toThrow();
    });
  });

  describe('Selective Retry Logic', () => {
    it('should not retry non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', {
        status: 400,
        statusText: 'Bad Request'
      }));
      
      await expect(client.get('/api/test')).rejects.toMatchObject({
        retryable: false
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should retry only retryable errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error')) // Retryable
        .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 })); // Not retryable
      
      await expect(client.get('/api/test')).rejects.toMatchObject({
        retryable: false
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 retry before 401
    });

    it('should respect skipRetry option', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
      
      await expect(client.get('/api/test', { skipRetry: true })).rejects.toThrow();
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Concurrent Retry Operations', () => {
    it('should handle multiple failing requests independently', async () => {
      let request1Count = 0;
      let request2Count = 0;
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('test1')) {
          request1Count++;
          if (request1Count <= 2) {
            return Promise.reject(new TypeError('Network error'));
          }
          return Promise.resolve(new Response('{"id": 1}', { status: 200 }));
        } else {
          request2Count++;
          if (request2Count <= 1) {
            return Promise.reject(new TypeError('Network error'));
          }
          return Promise.resolve(new Response('{"id": 2}', { status: 200 }));
        }
      });
      
      const promise1 = client.get('/api/test1');
      const promise2 = client.get('/api/test2');
      
      vi.advanceTimersByTime(1000);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(request1Count).toBe(3); // 2 failures + 1 success
      expect(request2Count).toBe(2); // 1 failure + 1 success
    });

    it('should not interfere with successful requests during retries', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error')) // First request fails
        .mockResolvedValueOnce(new Response('{"fast": true}', { status: 200 })) // Second request succeeds
        .mockResolvedValueOnce(new Response('{"slow": true}', { status: 200 })); // First request retry succeeds
      
      const slowPromise = client.get('/api/slow');
      const fastPromise = client.get('/api/fast');
      
      vi.advanceTimersByTime(50);
      const fastResult = await fastPromise;
      
      vi.advanceTimersByTime(500);
      const slowResult = await slowPromise;
      
      expect(fastResult).toEqual({ fast: true });
      expect(slowResult).toEqual({ slow: true });
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should track consecutive failures across retries', async () => {
      const statusCallback = vi.fn();
      client.subscribeToNetworkStatus(statusCallback);
      
      mockFetch.mockRejectedValue(new TypeError('Network error'));
      
      await expect(client.get('/api/test')).rejects.toThrow();
      
      // Should have updated network status after exhausting retries
      expect(statusCallback).toHaveBeenCalledWith(false);
    });

    it('should reset failure count on successful retry', async () => {
      const statusCallback = vi.fn();
      client.subscribeToNetworkStatus(statusCallback);
      
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));
      
      vi.advanceTimersByTime(200);
      const result = await client.get('/api/test');
      
      expect(result).toEqual({ success: true });
      // Should not have triggered offline status
      expect(statusCallback).not.toHaveBeenCalledWith(false);
    });
  });

  describe('Memory Management During Retries', () => {
    it('should clean up retry timers on successful completion', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));
      
      vi.advanceTimersByTime(200);
      await client.get('/api/test');
      
      // Should have cleared retry timeout after success
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should not leak memory on retry abort', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      mockFetch.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );
      
      const requestPromise = client.get('/api/test');
      vi.advanceTimersByTime(50);
      
      client.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
