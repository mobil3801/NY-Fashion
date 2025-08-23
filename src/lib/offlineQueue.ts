
import { generateId } from '@/lib/utils';

export interface QueuedOperation {
  id: string;
  type: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data: any;
  headers?: Record<string, string>;
  idempotencyKey: string;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

export interface OfflineQueueConfig {
  maxItems: number;
  maxAttempts: number;
  persistentStorage: boolean;
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxItems: 100,
  maxAttempts: 3,
  persistentStorage: true,
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
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async getAll(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result || []);
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
        // Load existing operations from IndexedDB
        try {
          this.memoryQueue = await this.idb.getAll();
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

  async enqueue(
    type: QueuedOperation['type'],
    url: string,
    data: any,
    headers: Record<string, string> = {}
  ): Promise<string> {
    await this.init();

    // Generate idempotency key if not provided
    const idempotencyKey = headers['Idempotency-Key'] || `${type}-${url}-${Date.now()}-${Math.random()}`;

    // Check for duplicate operations
    const isDuplicate = this.memoryQueue.some(
      op => op.idempotencyKey === idempotencyKey
    );

    if (isDuplicate) {
      throw new Error('Operation already queued');
    }

    const operation: QueuedOperation = {
      id: generateId(),
      type,
      url,
      data,
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
      idempotencyKey,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
    };

    // Enforce queue size limit
    if (this.memoryQueue.length >= this.config.maxItems) {
      const oldest = this.memoryQueue.shift();
      if (oldest && this.idb) {
        await this.idb.remove(oldest.id);
      }
    }

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
    return operation.id;
  }

  async flush(executor: (operation: QueuedOperation) => Promise<boolean>): Promise<number> {
    await this.init();

    let processedCount = 0;
    const operations = [...this.memoryQueue]; // Create a copy to iterate

    for (const operation of operations) {
      try {
        const success = await executor(operation);
        
        if (success) {
          await this.remove(operation.id);
          processedCount++;
        } else {
          // Increment attempt count
          operation.attempts++;
          
          if (operation.attempts >= operation.maxAttempts) {
            // Remove failed operation after max attempts
            await this.remove(operation.id);
            console.warn('Removing operation after max attempts:', operation);
          }
        }
      } catch (error) {
        console.error('Error processing queued operation:', error);
        operation.attempts++;
        
        if (operation.attempts >= operation.maxAttempts) {
          await this.remove(operation.id);
        }
      }
    }

    return processedCount;
  }

  async remove(id: string): Promise<void> {
    const index = this.memoryQueue.findIndex(op => op.id === id);
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
    return [...this.memoryQueue];
  }

  size(): number {
    return this.memoryQueue.length;
  }

  isEmpty(): boolean {
    return this.memoryQueue.length === 0;
  }

  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in queue listener:', error);
      }
    });
  }
}


