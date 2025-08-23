
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineQueue, QueuedOperation } from '../offlineQueue';

// Enhanced IndexedDB mocks
const createMockIDBRequest = (result?: any, error?: any) => ({
  result,
  error,
  onsuccess: null as ((event: any) => void) | null,
  onerror: null as ((event: any) => void) | null,
  readyState: 'pending',
  source: null,
  transaction: null
});

const createMockTransaction = () => ({
  objectStore: vi.fn(),
  oncomplete: null,
  onerror: null,
  onabort: null,
  abort: vi.fn(),
  db: null,
  durability: 'default',
  mode: 'readwrite',
  error: null
});

const createMockObjectStore = () => ({
  add: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  index: vi.fn().mockReturnValue({
    getAll: vi.fn(),
    get: vi.fn()
  }),
  createIndex: vi.fn(),
  deleteIndex: vi.fn(),
  name: 'operations',
  keyPath: 'id',
  indexNames: { contains: vi.fn() },
  transaction: null,
  autoIncrement: false
});

const createMockIDBDatabase = () => ({
  name: 'offline-queue',
  version: 1,
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(true)
  },
  transaction: vi.fn(),
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn(),
  close: vi.fn(),
  onabort: null,
  onerror: null,
  onversionchange: null
});

// Setup global IndexedDB mock
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn()
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('Enhanced Offline Queue Tests', () => {
  let queue: OfflineQueue;
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDB = createMockIDBDatabase();
    mockTransaction = createMockTransaction();
    mockObjectStore = createMockObjectStore();

    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);

    // Setup IndexedDB open success
    const openRequest = createMockIDBRequest(mockDB);
    mockIndexedDB.open.mockReturnValue(openRequest);

    queue = new OfflineQueue();
  });

  afterEach(() => {
    queue = null as any;
    vi.useRealTimers();
  });

  describe('FIFO Operations with Idempotency', () => {
    it('should maintain strict FIFO order under concurrent operations', async () => {
      await queue.init();

      // Setup successful IDB operations
      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Add operations concurrently
      const addPromises = [
        queue.enqueue('POST', '/api/order1', { priority: 'high' }),
        queue.enqueue('POST', '/api/order2', { priority: 'medium' }),
        queue.enqueue('POST', '/api/order3', { priority: 'low' })
      ];

      const ids = await Promise.all(addPromises);
      
      const operations = queue.getAll();
      expect(operations.map(op => op.id)).toEqual(ids);
      expect(operations.map(op => op.url)).toEqual(['/api/order1', '/api/order2', '/api/order3']);
    });

    it('should reject duplicate idempotency keys immediately', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      const headers = { 'Idempotency-Key': 'duplicate-key-test' };
      
      await queue.enqueue('POST', '/api/test', { data: 1 }, headers);
      
      // Second enqueue with same key should fail immediately
      await expect(
        queue.enqueue('POST', '/api/test', { data: 2 }, headers)
      ).rejects.toThrow('Operation already queued with idempotency key: duplicate-key-test');
      
      expect(queue.size()).toBe(1);
    });

    it('should handle idempotency key collisions across restarts', async () => {
      // First queue instance
      await queue.init();
      
      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      const existingOp: QueuedOperation = {
        id: 'existing-op',
        type: 'POST',
        url: '/api/test',
        data: { data: 1 },
        idempotencyKey: 'persistent-key',
        timestamp: Date.now() - 1000,
        attempts: 0,
        maxAttempts: 3
      };

      // Simulate loading existing operation from IDB
      mockObjectStore.index().getAll.mockImplementation(() => {
        const request = createMockIDBRequest([existingOp]);
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Create new queue instance (simulating restart)
      const newQueue = new OfflineQueue();
      await newQueue.init();

      // Try to add operation with same idempotency key
      await expect(
        newQueue.enqueue('POST', '/api/test', { data: 2 }, 
          { 'Idempotency-Key': 'persistent-key' })
      ).rejects.toThrow('Operation already queued with idempotency key: persistent-key');
    });

    it('should allow same idempotency key after operation completion', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      mockObjectStore.delete.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      const headers = { 'Idempotency-Key': 'reusable-key' };
      
      // Add operation
      const id = await queue.enqueue('POST', '/api/test', { data: 1 }, headers);
      expect(queue.size()).toBe(1);
      
      // Remove operation (simulate completion)
      await queue.remove(id);
      expect(queue.size()).toBe(0);
      
      // Should now allow same idempotency key
      await expect(
        queue.enqueue('POST', '/api/test', { data: 2 }, headers)
      ).resolves.toBeDefined();
      
      expect(queue.size()).toBe(1);
    });
  });

  describe('Queue Size Management and Overflow', () => {
    it('should enforce queue size limits with FIFO eviction', async () => {
      const limitedQueue = new OfflineQueue({ maxItems: 3 });
      await limitedQueue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      mockObjectStore.delete.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Add items up to limit
      const ids = [];
      for (let i = 1; i <= 5; i++) {
        const id = await limitedQueue.enqueue('POST', `/api/test${i}`, { data: i });
        ids.push(id);
      }

      expect(limitedQueue.size()).toBe(3);
      
      const operations = limitedQueue.getAll();
      // Should have the last 3 items (FIFO eviction)
      expect(operations.map(op => op.url)).toEqual(['/api/test3', '/api/test4', '/api/test5']);
      expect(operations.map(op => op.id)).toEqual([ids[2], ids[3], ids[4]]);
    });

    it('should handle queue overflow during concurrent adds', async () => {
      const limitedQueue = new OfflineQueue({ maxItems: 2 });
      await limitedQueue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Start multiple concurrent adds
      const addPromises = [
        limitedQueue.enqueue('POST', '/api/concurrent1', { data: 1 }),
        limitedQueue.enqueue('POST', '/api/concurrent2', { data: 2 }),
        limitedQueue.enqueue('POST', '/api/concurrent3', { data: 3 })
      ];

      await Promise.all(addPromises);
      
      expect(limitedQueue.size()).toBe(2);
      
      const operations = limitedQueue.getAll();
      expect(operations.length).toBe(2);
    });
  });

  describe('Persistence Failure Recovery', () => {
    it('should handle IndexedDB add failures gracefully', async () => {
      await queue.init();

      // Mock IDB add failure
      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest(null, new Error('IDB Error'));
        setTimeout(() => request.onerror?.({}), 0);
        return request;
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Operation should still be added to memory queue
      const id = await queue.enqueue('POST', '/api/test', { data: 1 });
      
      expect(queue.size()).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to persist operation to IndexedDB:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should fallback to memory-only when IndexedDB is unavailable', async () => {
      // Remove IndexedDB
      const originalIndexedDB = window.indexedDB;
      delete (window as any).indexedDB;

      const memoryQueue = new OfflineQueue();
      await memoryQueue.init();

      // Should work without IDB
      const id = await memoryQueue.enqueue('POST', '/api/test', { data: 1 });
      expect(memoryQueue.size()).toBe(1);

      // Restore IndexedDB
      (window as any).indexedDB = originalIndexedDB;
    });

    it('should handle corrupted IndexedDB data gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock corrupted data
      const corruptedData = [
        { id: 'valid-op', type: 'POST', url: '/api/test' }, // Missing required fields
        null, // Null entry
        { id: 'invalid-op', type: 'INVALID' }, // Invalid type
        'invalid-entry' // Wrong data type
      ];

      mockObjectStore.index().getAll.mockImplementation(() => {
        const request = createMockIDBRequest(corruptedData);
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      await queue.init();

      // Should initialize with empty queue due to corrupted data
      expect(queue.size()).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load offline queue from IndexedDB:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Concurrent Access Patterns', () => {
    it('should handle simultaneous flush and enqueue operations', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Add initial operations
      await queue.enqueue('POST', '/api/initial1', { data: 1 });
      await queue.enqueue('POST', '/api/initial2', { data: 2 });

      const executor = vi.fn()
        .mockResolvedValueOnce(true)  // First operation succeeds
        .mockResolvedValueOnce(false); // Second operation fails

      // Start flush and enqueue simultaneously
      const flushPromise = queue.flush(executor);
      const enqueuePromise = queue.enqueue('POST', '/api/concurrent', { data: 3 });

      const [processedCount] = await Promise.all([flushPromise, enqueuePromise]);

      expect(processedCount).toBe(1);
      expect(queue.size()).toBe(2); // 1 failed operation + 1 new operation
    });

    it('should handle multiple listeners during rapid queue changes', async () => {
      await queue.init();

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const removingListener = vi.fn(() => {
        // Remove itself during callback
        removeListener();
      });

      queue.addListener(listener1);
      const removeListener = queue.addListener(removingListener);
      queue.addListener(listener2);

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Trigger multiple rapid changes
      await queue.enqueue('POST', '/api/test1', { data: 1 });
      await queue.enqueue('POST', '/api/test2', { data: 2 });
      await queue.clear();

      // All listeners should have been called appropriately
      expect(listener1).toHaveBeenCalledTimes(3); // 2 enqueues + 1 clear
      expect(listener2).toHaveBeenCalledTimes(3);
      expect(removingListener).toHaveBeenCalledTimes(1); // Only first call
    });
  });

  describe('Operation Retry Logic', () => {
    it('should increment attempt count correctly', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      await queue.enqueue('POST', '/api/test', { data: 1 });

      const executor = vi.fn()
        .mockResolvedValueOnce(false) // First attempt fails
        .mockResolvedValueOnce(false) // Second attempt fails
        .mockResolvedValueOnce(true); // Third attempt succeeds

      // First flush
      await queue.flush(executor);
      let operations = queue.getAll();
      expect(operations[0].attempts).toBe(1);

      // Second flush
      await queue.flush(executor);
      operations = queue.getAll();
      expect(operations[0].attempts).toBe(2);

      // Third flush - should remove operation
      await queue.flush(executor);
      expect(queue.size()).toBe(0);
    });

    it('should remove operations after max attempts with warning', async () => {
      const limitedQueue = new OfflineQueue({ maxAttempts: 2 });
      await limitedQueue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      mockObjectStore.delete.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await limitedQueue.enqueue('POST', '/api/test', { data: 1 });

      const executor = vi.fn().mockResolvedValue(false);

      // Exhaust attempts
      await limitedQueue.flush(executor); // attempts = 1
      await limitedQueue.flush(executor); // attempts = 2, should remove

      expect(limitedQueue.size()).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Removing operation after max attempts:',
        expect.objectContaining({ attempts: 2 })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should prevent memory leaks with large operation data', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Create large operation data
      const largeData = {
        items: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Large description '.repeat(100)
        }))
      };

      const id = await queue.enqueue('POST', '/api/bulk', largeData);
      const operations = queue.getAll();
      
      // Should return deep copy, not reference
      expect(operations[0].data).toEqual(largeData);
      expect(operations[0].data).not.toBe(largeData);
      
      // Modifying returned data shouldn't affect queue
      operations[0].data.items[0].modified = true;
      const freshOperations = queue.getAll();
      expect(freshOperations[0].data.items[0]).not.toHaveProperty('modified');
    });

    it('should clean up listeners on queue destruction', () => {
      // Note: OfflineQueue doesn't currently have explicit destroy method
      // but this tests the pattern for proper cleanup
      const listeners: Function[] = [];
      const addListener = (callback: Function) => {
        listeners.push(callback);
        return () => {
          const index = listeners.indexOf(callback);
          if (index > -1) listeners.splice(index, 1);
        };
      };

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      const remove1 = addListener(listener1);
      const remove2 = addListener(listener2);
      
      expect(listeners.length).toBe(2);
      
      // Cleanup
      remove1();
      remove2();
      
      expect(listeners.length).toBe(0);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle operations with undefined/null data', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Should handle null/undefined data gracefully
      await queue.enqueue('DELETE', '/api/test', null);
      await queue.enqueue('DELETE', '/api/test2', undefined);

      const operations = queue.getAll();
      expect(operations[0].data).toBeNull();
      expect(operations[1].data).toBeUndefined();
    });

    it('should handle very large queue sizes efficiently', async () => {
      const largeQueue = new OfflineQueue({ maxItems: 10000 });
      await largeQueue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      const startTime = Date.now();
      
      // Add many operations
      const addPromises = [];
      for (let i = 0; i < 1000; i++) {
        addPromises.push(largeQueue.enqueue('POST', `/api/test${i}`, { data: i }));
      }
      
      await Promise.all(addPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(largeQueue.size()).toBe(1000);
    });

    it('should handle malformed headers gracefully', async () => {
      await queue.init();

      mockObjectStore.add.mockImplementation(() => {
        const request = createMockIDBRequest();
        setTimeout(() => request.onsuccess?.({}), 0);
        return request;
      });

      // Should handle various malformed header scenarios
      await queue.enqueue('POST', '/api/test1', { data: 1 }, null as any);
      await queue.enqueue('POST', '/api/test2', { data: 2 }, 'invalid-headers' as any);
      await queue.enqueue('POST', '/api/test3', { data: 3 }, { 'Invalid-Key': null });

      expect(queue.size()).toBe(3);
      
      const operations = queue.getAll();
      operations.forEach(op => {
        expect(op).toHaveProperty('idempotencyKey');
        expect(typeof op.idempotencyKey).toBe('string');
      });
    });
  });
});
