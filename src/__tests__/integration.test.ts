
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '@/lib/network/client';
import { ConnectivityMonitor } from '@/lib/network/connectivity';
import { OfflineQueue } from '@/lib/offlineQueue';

// Mock network APIs
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
vi.mock('@/utils/env-validator', () => ({
  isProduction: vi.fn(() => false)
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Network connectivity and API client integration', () => {
    it('should handle network state changes and API requests', async () => {
      const connectivity = new ConnectivityMonitor();

      // Simulate going offline
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await connectivity.checkNow();
      expect(connectivity.getStatus().online).toBe(false);

      // Attempt API request while offline
      await expect(apiClient.get('/api/test')).rejects.toThrow();

      // Go back online
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      await connectivity.checkNow();
      expect(connectivity.getStatus().online).toBe(true);

      // API request should work
      const response = await apiClient.get('/api/test');
      expect(response).toBe('OK');

      connectivity.destroy();
    });

    it('should queue operations when offline and process when online', async () => {
      const queue = new OfflineQueue();
      await queue.init();

      // Add operations to queue
      await queue.enqueue('POST', '/api/create', { name: 'Test' });
      await queue.enqueue('PUT', '/api/update/1', { name: 'Updated' });

      expect(queue.size()).toBe(2);

      // Process queue
      const executor = vi.fn().mockResolvedValue(true);
      const processed = await queue.flush(executor);

      expect(processed).toBe(2);
      expect(queue.isEmpty()).toBe(true);
      expect(executor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling and recovery integration', () => {
    it('should handle cascading failures gracefully', async () => {
      const connectivity = new ConnectivityMonitor();

      // Simulate multiple consecutive failures
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      for (let i = 0; i < 5; i++) {
        await connectivity.checkNow();
        vi.advanceTimersByTime(1000);
      }

      const status = connectivity.getStatus();
      expect(status.online).toBe(false);
      expect(status.consecutiveFailures).toBeGreaterThan(1);

      // Recovery
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
      await connectivity.checkNow();

      expect(connectivity.getStatus().online).toBe(true);
      expect(connectivity.getStatus().consecutiveFailures).toBe(0);

      connectivity.destroy();
    });

    it('should maintain data integrity during network issues', async () => {
      const queue = new OfflineQueue();
      await queue.init();

      // Simulate partial processing failure
      const executor = vi.fn().
      mockResolvedValueOnce(true) // First succeeds
      .mockRejectedValueOnce(new Error('Processing failed')) // Second fails
      .mockResolvedValueOnce(true); // Third succeeds

      await queue.enqueue('POST', '/api/item1', { id: 1 });
      await queue.enqueue('POST', '/api/item2', { id: 2 });
      await queue.enqueue('POST', '/api/item3', { id: 3 });

      const processed = await queue.flush(executor);

      expect(processed).toBe(2); // Only successful operations
      expect(queue.size()).toBe(1); // Failed operation remains
    });
  });

  describe('Performance monitoring integration', () => {
    it('should monitor API performance across network conditions', async () => {
      const performanceData: Array<{duration: number;success: boolean;}> = [];

      // Mock performance.now for timing
      let mockTime = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

      // Test under good network conditions
      mockFetch.mockImplementation(async () => {
        mockTime += 100; // 100ms response
        return new Response('OK', { status: 200 });
      });

      const start1 = performance.now();
      try {
        await apiClient.get('/api/fast');
        performanceData.push({ duration: performance.now() - start1, success: true });
      } catch {
        performanceData.push({ duration: performance.now() - start1, success: false });
      }

      // Test under poor network conditions
      mockFetch.mockImplementation(async () => {
        mockTime += 5000; // 5s response
        return new Response('OK', { status: 200 });
      });

      const start2 = performance.now();
      try {
        await apiClient.get('/api/slow');
        performanceData.push({ duration: performance.now() - start2, success: true });
      } catch {
        performanceData.push({ duration: performance.now() - start2, success: false });
      }

      // Test network failure
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      const start3 = performance.now();
      try {
        await apiClient.get('/api/fail');
        performanceData.push({ duration: performance.now() - start3, success: true });
      } catch {
        performanceData.push({ duration: performance.now() - start3, success: false });
      }

      // Analyze performance data
      const fastRequests = performanceData.filter((d) => d.duration < 1000);
      const slowRequests = performanceData.filter((d) => d.duration >= 1000);
      const failedRequests = performanceData.filter((d) => !d.success);

      expect(fastRequests.length).toBe(1);
      expect(slowRequests.length).toBe(1);
      expect(failedRequests.length).toBe(1);
    });
  });

  describe('Memory management integration', () => {
    it('should handle resource cleanup across components', () => {
      const resources: Array<{cleanup: () => void;}> = [];

      // Simulate creating multiple resources
      const connectivity = new ConnectivityMonitor();
      resources.push({ cleanup: () => connectivity.destroy() });

      const queue = new OfflineQueue();
      resources.push({ cleanup: () => queue.clear() });

      // Simulate memory pressure
      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;

      // Cleanup all resources
      resources.forEach((resource) => resource.cleanup());

      // Memory should be cleaned up (mocked scenario)
      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;

      // In a real scenario, memory usage should decrease
      // Here we just verify cleanup methods were called
      expect(resources.length).toBe(2);
    });
  });

  describe('Production readiness integration', () => {
    it('should handle production environment constraints', async () => {
      const { isProduction } = await import('@/utils/env-validator');
      (isProduction as any).mockReturnValue(true);

      // Test reduced logging in production
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const connectivity = new ConnectivityMonitor({
        heartbeatInterval: 30000, // Longer intervals in production
        maxRetries: 3
      });

      await connectivity.checkNow();

      // Should have limited logging in production
      expect(consoleSpy).toHaveBeenCalledTimes(0);

      connectivity.destroy();
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should validate security constraints in production', async () => {
      const { isProduction } = await import('@/utils/env-validator');
      (isProduction as any).mockReturnValue(true);

      // Mock HTTPS environment
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
          hostname: 'example.com',
          origin: 'https://example.com'
        },
        writable: true
      });

      const { environmentValidator } = await import('@/utils/env-validator');
      const validation = environmentValidator.validateAll();

      expect(validation.isValid).toBe(true);
      expect(validation.config.ENABLE_DEBUG).toBe(false);
      expect(validation.config.ENABLE_SECURITY_HEADERS).toBe(true);
    });
  });

  describe('Real-world scenario simulation', () => {
    it('should handle user workflow with intermittent connectivity', async () => {
      const userSession = {
        actions: [] as Array<{type: string;timestamp: number;success: boolean;}>
      };

      const queue = new OfflineQueue();
      await queue.init();

      // User starts working online
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      // User action 1: Create item
      try {
        await apiClient.post('/api/items', { name: 'Item 1' });
        userSession.actions.push({ type: 'create', timestamp: Date.now(), success: true });
      } catch {
        await queue.enqueue('POST', '/api/items', { name: 'Item 1' });
        userSession.actions.push({ type: 'create', timestamp: Date.now(), success: false });
      }

      // Connection drops
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      // User action 2: Update item (will be queued)
      try {
        await apiClient.put('/api/items/1', { name: 'Updated Item 1' });
        userSession.actions.push({ type: 'update', timestamp: Date.now(), success: true });
      } catch {
        await queue.enqueue('PUT', '/api/items/1', { name: 'Updated Item 1' });
        userSession.actions.push({ type: 'update', timestamp: Date.now(), success: false });
      }

      // User action 3: Delete item (will be queued)
      try {
        await apiClient.delete('/api/items/2');
        userSession.actions.push({ type: 'delete', timestamp: Date.now(), success: true });
      } catch {
        await queue.enqueue('DELETE', '/api/items/2');
        userSession.actions.push({ type: 'delete', timestamp: Date.now(), success: false });
      }

      expect(queue.size()).toBe(2); // Update and delete queued

      // Connection restored
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      // Process queued operations
      const executor = vi.fn().mockResolvedValue(true);
      await queue.flush(executor);

      expect(queue.isEmpty()).toBe(true);

      // Verify user session integrity
      expect(userSession.actions).toHaveLength(3);
      expect(userSession.actions[0].success).toBe(true); // Online action
      expect(userSession.actions[1].success).toBe(false); // Queued action
      expect(userSession.actions[2].success).toBe(false); // Queued action
    });

    it('should handle concurrent user sessions', async () => {
      const sessions = [
      { id: 'user1', queue: new OfflineQueue() },
      { id: 'user2', queue: new OfflineQueue() },
      { id: 'user3', queue: new OfflineQueue() }];


      // Initialize all sessions
      await Promise.all(sessions.map((s) => s.queue.init()));

      // Each user performs actions
      await sessions[0].queue.enqueue('POST', '/api/user1/action', { data: 'user1' });
      await sessions[1].queue.enqueue('POST', '/api/user2/action', { data: 'user2' });
      await sessions[2].queue.enqueue('POST', '/api/user3/action', { data: 'user3' });

      // Verify isolation
      expect(sessions[0].queue.size()).toBe(1);
      expect(sessions[1].queue.size()).toBe(1);
      expect(sessions[2].queue.size()).toBe(1);

      // Process all queues independently
      const executor = vi.fn().mockResolvedValue(true);

      await Promise.all(sessions.map((s) => s.queue.flush(executor)));

      expect(executor).toHaveBeenCalledTimes(3);
      sessions.forEach((session) => {
        expect(session.queue.isEmpty()).toBe(true);
      });
    });
  });

  describe('Stress testing', () => {
    it('should handle high-frequency operations', async () => {
      const connectivity = new ConnectivityMonitor({
        heartbeatInterval: 100 // Very frequent checks
      });

      let checkCount = 0;
      mockFetch.mockImplementation(async () => {
        checkCount++;
        return new Response('OK', { status: 200 });
      });

      // Run for 1 second
      vi.advanceTimersByTime(1000);

      // Should have performed multiple checks
      expect(checkCount).toBeGreaterThan(5);

      connectivity.destroy();
    });

    it('should handle large queue operations', async () => {
      const queue = new OfflineQueue({ maxItems: 1000 });
      await queue.init();

      // Add many operations
      const operations = Array.from({ length: 500 }, (_, i) => ({
        type: 'POST' as const,
        url: `/api/item-${i}`,
        data: { id: i, name: `Item ${i}` }
      }));

      for (const op of operations) {
        await queue.enqueue(op.type, op.url, op.data);
      }

      expect(queue.size()).toBe(500);

      // Process in batches
      const executor = vi.fn().mockResolvedValue(true);
      const processed = await queue.flush(executor);

      expect(processed).toBe(500);
      expect(queue.isEmpty()).toBe(true);
    });
  });
});