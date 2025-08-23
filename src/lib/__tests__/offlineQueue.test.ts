
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineQueue, QueuedOperation } from '../offlineQueue';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const mockIDBDatabase = {
  createObjectStore: vi.fn().mockReturnValue({
    createIndex: vi.fn(),
  }),
  transaction: vi.fn(),
  objectStoreNames: {
    contains: vi.fn().mockReturnValue(false),
  },
};

const mockTransaction = {
  objectStore: vi.fn(),
  oncomplete: null,
  onerror: null,
};

const mockObjectStore = {
  add: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(),
  index: vi.fn().mockReturnValue({
    getAll: vi.fn(),
  }),
};

const mockRequest = {
  onsuccess: null,
  onerror: null,
  result: null,
};

// Setup IndexedDB mocks
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

describe('OfflineQueue', () => {
  let queue: OfflineQueue;
  let mockSuccessCallback: any;
  let mockErrorCallback: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockIndexedDB.open.mockReturnValue({
      ...mockRequest,
      onupgradeneeded: null,
    });
    
    mockIDBDatabase.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    
    mockObjectStore.add.mockReturnValue(mockRequest);
    mockObjectStore.delete.mockReturnValue(mockRequest);
    mockObjectStore.clear.mockReturnValue(mockRequest);
    mockObjectStore.getAll.mockReturnValue(mockRequest);
    mockObjectStore.index().getAll.mockReturnValue(mockRequest);
    
    // Mock successful callbacks
    mockSuccessCallback = vi.fn((request: any) => {
      if (request.onsuccess) request.onsuccess();
    });
    mockErrorCallback = vi.fn((request: any) => {
      if (request.onerror) request.onerror();
    });
    
    queue = new OfflineQueue();
  });

  afterEach(() => {
    queue = null as any;
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(queue).toBeDefined();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customQueue = new OfflineQueue({
        maxItems: 50,
        maxAttempts: 5,
        persistentStorage: false,
      });
      
      expect(customQueue).toBeDefined();
      expect(customQueue.isEmpty()).toBe(true);
    });

    it('should initialize IndexedDB when persistent storage is enabled', async () => {
      mockIndexedDB.open.mockReturnValue({
        ...mockRequest,
        onsuccess: null,
        onupgradeneeded: null,
      });
      
      const openRequest = mockIndexedDB.open.mockReturnValue(mockRequest);
      
      const initPromise = queue.init();
      
      // Simulate successful IDB open
      openRequest.result = mockIDBDatabase;
      if (openRequest.onsuccess) openRequest.onsuccess();
      
      await initPromise;
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('offline-queue', 1);
    });

    it('should handle IndexedDB initialization failure gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockIndexedDB.open.mockReturnValue({
        ...mockRequest,
        onerror: null,
      });
      
      const openRequest = mockIndexedDB.open.mockReturnValue(mockRequest);
      
      const initPromise = queue.init();
      
      // Simulate IDB failure
      if (openRequest.onerror) openRequest.onerror();
      
      await initPromise;
      
      // Should still work with memory-only storage
      expect(queue.isEmpty()).toBe(true);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('enqueueing operations', () => {
    it('should enqueue operations in FIFO order', async () => {
      await queue.init();
      
      const id1 = await queue.enqueue('POST', '/api/test1', { data: 1 });
      const id2 = await queue.enqueue('PUT', '/api/test2', { data: 2 });
      const id3 = await queue.enqueue('DELETE', '/api/test3', undefined);
      
      expect(queue.size()).toBe(3);
      
      const operations = queue.getAll();
      expect(operations[0].id).toBe(id1);
      expect(operations[0].type).toBe('POST');
      expect(operations[0].url).toBe('/api/test1');
      expect(operations[1].id).toBe(id2);
      expect(operations[2].id).toBe(id3);
    });

    it('should generate unique idempotency keys', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test', { data: 1 });
      await queue.enqueue('POST', '/api/test', { data: 2 });
      
      const operations = queue.getAll();
      expect(operations[0].idempotencyKey).not.toBe(operations[1].idempotencyKey);
    });

    it('should use provided idempotency key', async () => {
      await queue.init();
      
      const customKey = 'custom-key-123';
      await queue.enqueue('POST', '/api/test', { data: 1 }, {
        'Idempotency-Key': customKey,
      });
      
      const operations = queue.getAll();
      expect(operations[0].idempotencyKey).toBe(customKey);
      expect(operations[0].headers!['Idempotency-Key']).toBe(customKey);
    });

    it('should prevent duplicate operations with same idempotency key', async () => {
      await queue.init();
      
      const headers = { 'Idempotency-Key': 'duplicate-key' };
      
      await queue.enqueue('POST', '/api/test', { data: 1 }, headers);
      
      await expect(queue.enqueue('POST', '/api/test', { data: 2 }, headers))
        .rejects.toThrow('Operation already queued');
      
      expect(queue.size()).toBe(1);
    });

    it('should enforce queue size limit', async () => {
      const limitedQueue = new OfflineQueue({ maxItems: 2 });
      await limitedQueue.init();
      
      await limitedQueue.enqueue('POST', '/api/test1', { data: 1 });
      await limitedQueue.enqueue('POST', '/api/test2', { data: 2 });
      await limitedQueue.enqueue('POST', '/api/test3', { data: 3 });
      
      expect(limitedQueue.size()).toBe(2);
      
      const operations = limitedQueue.getAll();
      expect(operations[0].url).toBe('/api/test2'); // First one should be removed
      expect(operations[1].url).toBe('/api/test3');
    });

    it('should persist operations to IndexedDB', async () => {
      mockIndexedDB.open.mockReturnValue({
        ...mockRequest,
        result: mockIDBDatabase,
      });
      
      await queue.init();
      
      // Mock successful IDB operations
      mockObjectStore.add.mockReturnValue({
        ...mockRequest,
        onsuccess: null,
      });
      
      const addRequest = mockObjectStore.add.mockReturnValue(mockRequest);
      
      const enqueuePromise = queue.enqueue('POST', '/api/test', { data: 1 });
      
      // Simulate successful add
      if (addRequest.onsuccess) addRequest.onsuccess();
      
      await enqueuePromise;
      
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'POST',
          url: '/api/test',
          data: { data: 1 },
        })
      );
    });
  });

  describe('flushing operations', () => {
    it('should flush operations successfully', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test1', { data: 1 });
      await queue.enqueue('PUT', '/api/test2', { data: 2 });
      
      const executor = vi.fn().mockResolvedValue(true);
      
      const processedCount = await queue.flush(executor);
      
      expect(processedCount).toBe(2);
      expect(executor).toHaveBeenCalledTimes(2);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle executor failures gracefully', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test1', { data: 1 });
      await queue.enqueue('POST', '/api/test2', { data: 2 });
      
      const executor = vi.fn()
        .mockResolvedValueOnce(false) // First operation fails
        .mockResolvedValueOnce(true);  // Second operation succeeds
      
      const processedCount = await queue.flush(executor);
      
      expect(processedCount).toBe(1);
      expect(queue.size()).toBe(1); // Failed operation remains
      
      const remainingOps = queue.getAll();
      expect(remainingOps[0].attempts).toBe(1);
    });

    it('should remove operations after max attempts', async () => {
      const limitedQueue = new OfflineQueue({ maxAttempts: 2 });
      await limitedQueue.init();
      
      await limitedQueue.enqueue('POST', '/api/test', { data: 1 });
      
      const executor = vi.fn().mockResolvedValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // First flush - increment attempts to 1
      await limitedQueue.flush(executor);
      expect(limitedQueue.size()).toBe(1);
      
      // Second flush - increment attempts to 2, should remove
      await limitedQueue.flush(executor);
      expect(limitedQueue.size()).toBe(0);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Removing operation after max attempts:',
        expect.any(Object)
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle executor exceptions', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test', { data: 1 });
      
      const executor = vi.fn().mockRejectedValue(new Error('Executor error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const processedCount = await queue.flush(executor);
      
      expect(processedCount).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error processing queued operation:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('operation management', () => {
    it('should remove operations by ID', async () => {
      await queue.init();
      
      const id1 = await queue.enqueue('POST', '/api/test1', { data: 1 });
      const id2 = await queue.enqueue('POST', '/api/test2', { data: 2 });
      
      await queue.remove(id1);
      
      expect(queue.size()).toBe(1);
      expect(queue.getAll()[0].id).toBe(id2);
    });

    it('should clear all operations', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test1', { data: 1 });
      await queue.enqueue('POST', '/api/test2', { data: 2 });
      
      await queue.clear();
      
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should get all operations as immutable copies', async () => {
      await queue.init();
      
      await queue.enqueue('POST', '/api/test', { data: 1 });
      
      const operations1 = queue.getAll();
      const operations2 = queue.getAll();
      
      expect(operations1).not.toBe(operations2); // Different array instances
      expect(operations1[0]).toEqual(operations2[0]); // Same content
      
      // Modifying returned array shouldn't affect queue
      operations1.pop();
      expect(queue.size()).toBe(1);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on queue changes', async () => {
      await queue.init();
      
      const listener = vi.fn();
      const removeListener = queue.addListener(listener);
      
      await queue.enqueue('POST', '/api/test', { data: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      
      await queue.clear();
      expect(listener).toHaveBeenCalledTimes(2);
      
      removeListener();
      
      await queue.enqueue('POST', '/api/test2', { data: 2 });
      expect(listener).toHaveBeenCalledTimes(2); // Should not be called after removal
    });

    it('should handle errors in listeners gracefully', async () => {
      await queue.init();
      
      const errorListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      queue.addListener(errorListener);
      queue.addListener(goodListener);
      
      await queue.enqueue('POST', '/api/test', { data: 1 });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in queue listener:',
        expect.any(Error)
      );
      expect(goodListener).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('IndexedDB integration', () => {
    it('should load existing operations from IndexedDB on init', async () => {
      const existingOperations: QueuedOperation[] = [
        {
          id: 'test-1',
          type: 'POST',
          url: '/api/test1',
          data: { data: 1 },
          idempotencyKey: 'key1',
          timestamp: Date.now(),
          attempts: 0,
          maxAttempts: 3,
        },
        {
          id: 'test-2',
          type: 'PUT',
          url: '/api/test2',
          data: { data: 2 },
          idempotencyKey: 'key2',
          timestamp: Date.now(),
          attempts: 1,
          maxAttempts: 3,
        },
      ];
      
      mockIndexedDB.open.mockReturnValue({
        ...mockRequest,
        result: mockIDBDatabase,
      });
      
      const getAllRequest = {
        ...mockRequest,
        result: existingOperations,
      };
      
      mockObjectStore.index().getAll.mockReturnValue(getAllRequest);
      
      const initPromise = queue.init();
      
      // Simulate successful IDB open
      const openRequest = mockIndexedDB.open();
      openRequest.result = mockIDBDatabase;
      if (openRequest.onsuccess) openRequest.onsuccess();
      
      // Simulate successful getAll
      if (getAllRequest.onsuccess) getAllRequest.onsuccess();
      
      await initPromise;
      
      expect(queue.size()).toBe(2);
      
      const operations = queue.getAll();
      expect(operations[0].id).toBe('test-1');
      expect(operations[1].id).toBe('test-2');
      expect(operations[1].attempts).toBe(1);
    });

    it('should handle IndexedDB errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockIndexedDB.open.mockReturnValue({
        ...mockRequest,
        result: mockIDBDatabase,
      });
      
      // Mock getAll to fail
      const getAllRequest = {
        ...mockRequest,
        onerror: null,
      };
      
      mockObjectStore.index().getAll.mockReturnValue(getAllRequest);
      
      const initPromise = queue.init();
      
      // Simulate successful IDB open
      const openRequest = mockIndexedDB.open();
      openRequest.result = mockIDBDatabase;
      if (openRequest.onsuccess) openRequest.onsuccess();
      
      // Simulate getAll error
      if (getAllRequest.onerror) getAllRequest.onerror();
      
      await initPromise;
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load offline queue from IndexedDB:',
        expect.any(Error)
      );
      
      // Should still work with memory-only
      expect(queue.isEmpty()).toBe(true);
      
      consoleWarnSpy.mockRestore();
    });

    it('should fallback to memory-only when IndexedDB unavailable', async () => {
      const originalIndexedDB = window.indexedDB;
      
      // Remove IndexedDB
      delete (window as any).indexedDB;
      
      const memoryQueue = new OfflineQueue();
      await memoryQueue.init();
      
      await memoryQueue.enqueue('POST', '/api/test', { data: 1 });
      expect(memoryQueue.size()).toBe(1);
      
      // Restore IndexedDB
      (window as any).indexedDB = originalIndexedDB;
    });
  });

  describe('edge cases', () => {
    it('should handle empty queue flush', async () => {
      await queue.init();
      
      const executor = vi.fn();
      const processedCount = await queue.flush(executor);
      
      expect(processedCount).toBe(0);
      expect(executor).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent operation', async () => {
      await queue.init();
      
      // Should not throw
      await expect(queue.remove('non-existent-id')).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      const initPromise1 = queue.init();
      const initPromise2 = queue.init();
      
      await Promise.all([initPromise1, initPromise2]);
      
      // Should not cause issues
      expect(queue.isEmpty()).toBe(true);
    });
  });
});
