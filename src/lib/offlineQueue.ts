

export interface QueuedOperation {
  id: string;
  url: string;
  type: 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  headers?: Record<string, string>;
  idempotencyKey: string;
  createdAt: number;
}

export interface OfflineQueueConfig {
  maxItems: number;
  maxAttempts: number;
  persistentStorage: boolean;
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxItems: 100,
  maxAttempts: 3,
  persistentStorage: true
};

// Generate idempotency key with crypto.randomUUID() and fallback
const generateIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      console.warn('crypto.randomUUID() failed, using fallback:', error);
    }
  }
  
  // Fallback implementation
  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

class IndexedDBWrapper {
  private dbName = 'offline-queue';
  private storeName = 'operations';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    if (!('indexedDB' in window)) {
      return false;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => resolve(false);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: false });
        }
      };
    });
  }

  async getAll(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('createdAt');
      const request = index.getAll();

      request.onsuccess = () => {
        // Ensure FIFO ordering by sorting by createdAt
        const results = (request.result || []).sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async add(operation: QueuedOperation): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export class OfflineQueue {
  private config: OfflineQueueConfig;
  private idb: IndexedDBWrapper | null = null;
  private memoryQueue: QueuedOperation[] = [];
  private isInitialized = false;
  private listeners: Set<() => void> = new Set();

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.config.persistentStorage) {
      this.idb = new IndexedDBWrapper();
      const success = await this.idb.init();

      if (success) {
        // Load existing operations from IndexedDB and ensure FIFO ordering
        try {
          this.memoryQueue = await this.idb.getAll();
          // Sort by createdAt to ensure FIFO ordering
          this.memoryQueue.sort((a, b) => a.createdAt - b.createdAt);
        } catch (error) {
          console.warn('Failed to load offline queue from IndexedDB:', error);
          this.idb = null;
        }
      } else {
        this.idb = null;
      }
    }

    this.isInitialized = true;
  }

  async enqueue(type: 'POST' | 'PUT' | 'DELETE', url: string, data?: any, headers?: Record<string, string>): Promise<void> {
    await this.init();

    // Generate idempotency key and id
    const idempotencyKey = headers?.['Idempotency-Key'] || generateIdempotencyKey();
    const id = generateIdempotencyKey();

    // Check for duplicate operations by idempotency key
    const isDuplicate = this.memoryQueue.some(
      (op) => op.idempotencyKey === idempotencyKey
    );

    if (isDuplicate) {
      throw new Error('Operation already queued');
    }

    const operation: QueuedOperation = {
      id,
      url,
      type,
      data,
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
      idempotencyKey,
      createdAt: Date.now()
    };

    // Enforce queue size limit (remove oldest to maintain FIFO)
    if (this.memoryQueue.length >= this.config.maxItems) {
      const oldest = this.memoryQueue.shift();
      if (oldest && this.idb) {
        await this.idb.remove(oldest.id);
      }
    }

    // Add to end of queue (FIFO)
    this.memoryQueue.push(operation);

    // Persist to IndexedDB if available
    if (this.idb) {
      try {
        await this.idb.add(operation);
      } catch (error) {
        console.warn('Failed to persist operation to IndexedDB:', error);
      }
    }

    this.notifyListeners();
  }

  async flush(processOperation: (operation: QueuedOperation) => Promise<boolean>): Promise<number> {
    await this.init();

    // Process operations in FIFO order (first to last)
    const operations = [...this.memoryQueue]; // Create a copy to iterate
    let processedCount = 0;

    for (const operation of operations) {
      try {
        const success = await processOperation(operation);
        if (success) {
          // If processing succeeded, remove from queue
          await this.remove(operation.id);
          processedCount++;
        }
      } catch (error) {
        console.error('Error processing queued operation:', error);
        // Keep the operation in queue for potential retry
      }
    }

    return processedCount;
  }

  async remove(id: string): Promise<void> {
    const index = this.memoryQueue.findIndex((op) => op.id === id);
    if (index !== -1) {
      this.memoryQueue.splice(index, 1);
    }

    if (this.idb) {
      try {
        await this.idb.remove(id);
      } catch (error) {
        console.warn('Failed to remove operation from IndexedDB:', error);
      }
    }

    this.notifyListeners();
  }

  async size(): Promise<number> {
    await this.init();
    return this.memoryQueue.length;
  }

  size(): number {
    return this.memoryQueue.length;
  }

  async clear(): Promise<void> {
    this.memoryQueue = [];

    if (this.idb) {
      try {
        await this.idb.clear();
      } catch (error) {
        console.warn('Failed to clear IndexedDB:', error);
      }
    }

    this.notifyListeners();
  }

  getAll(): QueuedOperation[] {
    // Return copy sorted by createdAt to ensure FIFO ordering
    return [...this.memoryQueue].sort((a, b) => a.createdAt - b.createdAt);
  }

  isEmpty(): boolean {
    return this.memoryQueue.length === 0;
  }

  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Error in queue listener:', error);
      }
    });
  }
}

// Export default instance
export const offlineQueue = new OfflineQueue();
