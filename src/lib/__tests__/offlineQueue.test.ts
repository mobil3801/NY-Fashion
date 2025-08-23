
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineQueue } from '../offlineQueue';

// Mock IndexedDB
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null as any,
  onerror: null as any
};

const mockIDBTransaction = {
  objectStore: vi.fn(() => ({
    add: vi.fn(() => mockIDBRequest),
    delete: vi.fn(() => mockIDBRequest),
    clear: vi.fn(() => mockIDBRequest),
    index: vi.fn(() => ({
      getAll: vi.fn(() => mockIDBRequest)
    }))
  }))
};

const mockIDBDatabase = {
  transaction: vi.fn(() => mockIDBTransaction),
  objectStoreNames: { contains: vi.fn(() => false) },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn()
  }))
};

const mockIDBFactory = {
  open: vi.fn(() => {
    const request = { ...mockIDBRequest };
    setTimeout(() => {
      request.result = mockIDBDatabase;
      request.onsuccess?.();
    }, 0);
    return request;
  })
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIDBFactory,
  writable: true
});

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new OfflineQueue({ persistentStorage: false }); // Use in-memory for testing
  });

  it('should enqueue operations', async () => {
    await queue.init();

    const id = await queue.enqueue('POST', '/api/test', { data: 'test' });

    expect(id).toBeTruthy();
    expect(queue.size()).toBe(1);
    expect(queue.isEmpty()).toBe(false);
  });

  it('should prevent duplicate operations', async () => {
    await queue.init();

    await queue.enqueue('POST', '/api/test', { data: 'test' }, { 'Idempotency-Key': 'test-key' });

    await expect(
      queue.enqueue('POST', '/api/test', { data: 'test' }, { 'Idempotency-Key': 'test-key' })
    ).rejects.toThrow('Operation already queued');
  });

  it('should flush operations in FIFO order', async () => {
    await queue.init();

    await queue.enqueue('POST', '/api/test1', { data: 'test1' });
    await queue.enqueue('POST', '/api/test2', { data: 'test2' });

    const executedOperations: string[] = [];

    const processedCount = await queue.flush(async (operation) => {
      executedOperations.push(operation.url);
      return true; // Success
    });

    expect(processedCount).toBe(2);
    expect(executedOperations).toEqual(['/api/test1', '/api/test2']);
    expect(queue.isEmpty()).toBe(true);
  });

  it('should handle failed operations with retry logic', async () => {
    await queue.init();

    await queue.enqueue('POST', '/api/test', { data: 'test' });

    let attempts = 0;
    await queue.flush(async () => {
      attempts++;
      return false; // Simulate failure
    });

    expect(attempts).toBe(1);
    expect(queue.size()).toBe(1); // Still in queue for retry

    // After max attempts, should be removed
    const operations = queue.getAll();
    operations[0].attempts = 3; // Set to max

    await queue.flush(async () => false);
    expect(queue.isEmpty()).toBe(true); // Removed after max attempts
  });

  it('should respect size limits', async () => {
    const smallQueue = new OfflineQueue({ maxItems: 2, persistentStorage: false });
    await smallQueue.init();

    await smallQueue.enqueue('POST', '/api/test1', { data: 'test1' });
    await smallQueue.enqueue('POST', '/api/test2', { data: 'test2' });
    await smallQueue.enqueue('POST', '/api/test3', { data: 'test3' }); // Should evict first

    expect(smallQueue.size()).toBe(2);
    const operations = smallQueue.getAll();
    expect(operations.map((op) => op.url)).toEqual(['/api/test2', '/api/test3']);
  });

  it('should notify listeners on changes', async () => {
    await queue.init();

    const listener = vi.fn();
    const unsubscribe = queue.addListener(listener);

    await queue.enqueue('POST', '/api/test', { data: 'test' });

    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('should clear all operations', async () => {
    await queue.init();

    await queue.enqueue('POST', '/api/test1', { data: 'test1' });
    await queue.enqueue('POST', '/api/test2', { data: 'test2' });

    await queue.clear();

    expect(queue.isEmpty()).toBe(true);
  });
});