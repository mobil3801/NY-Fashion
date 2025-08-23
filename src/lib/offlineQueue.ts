// Schema versioning constants - Bump to v2 to add missing createdAt index
const QUEUE_DB_NAME = "app-offline-queue";
const QUEUE_STORE = "queue";
const QUEUE_DB_VERSION = 2; // Bumped from 1 to add missing index
const IDX_CREATED_AT = "idx_createdAt";
const IDX_IDEMPOTENCY = "idx_idempotencyKey";

// Retry constants
const MAX_IDB_RETRIES = 1;
const IDB_RETRY_DELAY = 100;

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
    const v = c === 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
};

class IndexedDBWrapper {
  private dbName = QUEUE_DB_NAME;
  private storeName = QUEUE_STORE;
  private version = QUEUE_DB_VERSION;
  private db: IDBDatabase | null = null;
  private isAvailable = false;

  async init(): Promise<boolean> {
    if (!('indexedDB' in window)) {
      console.warn('[OfflineQueue] IndexedDB not available');
      return false;
    }

    try {
      return await this.openDatabase();
    } catch (error) {
      console.error('[OfflineQueue] Failed to initialize IndexedDB:', error);
      return false;
    }
  }

  private async openDatabase(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('[OfflineQueue] Database open error:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isAvailable = true;

        // Verify store and indexes exist
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          console.error('[OfflineQueue] Store missing after open');
          this.db.close();
          this.db = null;
          this.isAvailable = false;
          resolve(false);
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[OfflineQueue] IDB ready (v2)');
        }
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          // Handle schema migrations with enhanced error handling
          this.performSchemaUpgrade(db, event.oldVersion, event.newVersion || this.version);

          // Verify the upgrade was successful
          if (!db.objectStoreNames.contains(this.storeName)) {
            throw new Error('Store was not created during upgrade');
          }

          console.log('[OfflineQueue] Schema upgrade completed successfully');
        } catch (error) {
          console.error('[OfflineQueue] Schema upgrade failed:', error);

          // Attempt emergency recovery
          try {
            if (db.objectStoreNames.contains(this.storeName)) {
              db.deleteObjectStore(this.storeName);
            }

            const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
            store.createIndex(IDX_CREATED_AT, 'createdAt', { unique: false });
            store.createIndex(IDX_IDEMPOTENCY, 'idempotencyKey', { unique: false });
            console.log('[OfflineQueue] Emergency recovery: Created fresh store');
          } catch (recoveryError) {
            console.error('[OfflineQueue] Emergency recovery failed:', recoveryError);
            resolve(false);
            return;
          }
        }
      };

      request.onblocked = () => {
        console.warn('[OfflineQueue] Database upgrade blocked');
        resolve(false);
      };
    });
  }

  private performSchemaUpgrade(db: IDBDatabase, oldVersion: number, newVersion: number): void {
    console.log(`[OfflineQueue] Upgrading schema from ${oldVersion} to ${newVersion}`);

    // Handle initial creation (oldVersion 0)
    if (oldVersion === 0) {
      const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
      store.createIndex(IDX_CREATED_AT, 'createdAt', { unique: false });
      store.createIndex(IDX_IDEMPOTENCY, 'idempotencyKey', { unique: false });
      console.log('[OfflineQueue] Created initial schema with all indexes');
      return;
    }

    // Handle version 1 to 2 migration - add missing createdAt index
    if (oldVersion < 2 && newVersion >= 2) {
      let store: IDBObjectStore;

      // Get or recreate the store
      if (db.objectStoreNames.contains(this.storeName)) {
        // Try to access the store through transaction
        try {
          const transaction = (db as any).transaction;
          if (transaction && transaction.objectStore) {
            store = transaction.objectStore(this.storeName);
          } else {
            throw new Error('Cannot access store during upgrade, recreating');
          }
        } catch (error) {
          console.warn('[OfflineQueue] Cannot modify existing store, recreating:', error);
          db.deleteObjectStore(this.storeName);
          store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      } else {
        store = db.createObjectStore(this.storeName, { keyPath: 'id' });
      }

      // Add missing indexes idempotently
      try {
        if (!store.indexNames.contains(IDX_CREATED_AT)) {
          store.createIndex(IDX_CREATED_AT, 'createdAt', { unique: false });
          console.log('[OfflineQueue] Added createdAt index in v2 migration');
        }

        if (!store.indexNames.contains(IDX_IDEMPOTENCY)) {
          store.createIndex(IDX_IDEMPOTENCY, 'idempotencyKey', { unique: false });
          console.log('[OfflineQueue] Added idempotencyKey index in v2 migration');
        }
      } catch (indexError) {
        console.error('[OfflineQueue] Error adding indexes:', indexError);
        // If index creation fails, recreate the entire store
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }

        store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex(IDX_CREATED_AT, 'createdAt', { unique: false });
        store.createIndex(IDX_IDEMPOTENCY, 'idempotencyKey', { unique: false });
        console.log('[OfflineQueue] Recreated store with proper indexes');
      }

      if (import.meta.env.DEV) {
        console.log('[OfflineQueue] Applied v2 migration successfully');
      }
    }
  }

  async getAll(): Promise<QueuedOperation[]> {
    if (!this.isAvailable || !this.db) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        // Try to use the createdAt index, with retry mechanism
        let request: IDBRequest;
        try {
          const index = store.index(IDX_CREATED_AT);
          request = index.getAll();
        } catch (indexError) {
          // Index not found - this should not happen after v2 migration
          // But provide fallback and trigger a retry mechanism
          console.warn('[OfflineQueue] createdAt index not found after v2 migration, using fallback');
          request = store.getAll();
        }

        request.onsuccess = () => {
          // Ensure FIFO ordering by sorting by createdAt
          const results = (request.result || []).sort((a: QueuedOperation, b: QueuedOperation) => a.createdAt - b.createdAt);
          resolve(results);
        };

        request.onerror = () => {
          console.error('[OfflineQueue] getAll error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[OfflineQueue] getAll transaction error:', error);
        reject(error);
      }
    });
  }

  async add(operation: QueuedOperation): Promise<void> {
    if (!this.isAvailable || !this.db) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(operation);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[OfflineQueue] add error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[OfflineQueue] add transaction error:', error);
        reject(error);
      }
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.isAvailable || !this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[OfflineQueue] remove error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[OfflineQueue] remove transaction error:', error);
        reject(error);
      }
    });
  }

  async clear(): Promise<void> {
    if (!this.isAvailable || !this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('[OfflineQueue] clear error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[OfflineQueue] clear transaction error:', error);
        reject(error);
      }
    });
  }

  async count(): Promise<number> {
    if (!this.isAvailable || !this.db) return 0;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('[OfflineQueue] count error:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('[OfflineQueue] count transaction error:', error);
        reject(error);
      }
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isAvailable = false;
    }
  }
}

export class OfflineQueue {
  private config: OfflineQueueConfig;
  private idb: IndexedDBWrapper | null = null;
  private memoryQueue: QueuedOperation[] = [];
  private isInitialized = false;
  private listeners: Set<() => void> = new Set();
  private useMemoryFallback = false;
  private idbRetryAttempts = 0;

  constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.config.persistentStorage && !this.useMemoryFallback) {
      await this.initializeIDB();
    }

    this.isInitialized = true;
    if (import.meta.env.DEV) {
      console.log(`[OfflineQueue] Initialized (${this.useMemoryFallback ? 'memory-only' : 'persistent'} mode)`);
    }
  }

  private async initializeIDB(): Promise<void> {
    this.idb = new IndexedDBWrapper();

    try {
      const success = await this.idb.init();

      if (success) {
        // Load existing operations from IndexedDB and ensure FIFO ordering
        try {
          this.memoryQueue = await this.idb.getAll();
          // Sort by createdAt to ensure FIFO ordering
          this.memoryQueue.sort((a, b) => a.createdAt - b.createdAt);
        } catch (error) {
          console.warn('[OfflineQueue] Failed to load from IndexedDB, retrying once...', error);

          // Retry once on NotFoundError or similar issues
          if (this.idbRetryAttempts < MAX_IDB_RETRIES) {
            this.idbRetryAttempts++;
            await new Promise((resolve) => setTimeout(resolve, IDB_RETRY_DELAY));

            // Try to reopen database (which triggers upgrade if needed)
            const retrySuccess = await this.idb.init();
            if (retrySuccess) {
              try {
                this.memoryQueue = await this.idb.getAll();
                this.memoryQueue.sort((a, b) => a.createdAt - b.createdAt);
                console.log('[OfflineQueue] Recovery successful on retry');
                return;
              } catch (retryError) {
                console.error('[OfflineQueue] Retry also failed:', retryError);
              }
            }
          }

          // Fall back to memory-only mode
          this.fallbackToMemory();
        }
      } else {
        this.fallbackToMemory();
      }
    } catch (error) {
      console.error('[OfflineQueue] IDB initialization failed:', error);
      this.fallbackToMemory();
    }
  }

  private fallbackToMemory(): void {
    console.warn('[OfflineQueue] Falling back to memory-only mode');
    this.useMemoryFallback = true;
    this.idb?.close();
    this.idb = null;
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
      if (oldest && this.idb && !this.useMemoryFallback) {
        try {
          await this.idb.remove(oldest.id);
        } catch (error) {
          console.warn('[OfflineQueue] Failed to remove oldest from IDB:', error);
        }
      }
    }

    // Add to end of queue (FIFO)
    this.memoryQueue.push(operation);

    // Persist to IndexedDB if available and not in memory fallback mode
    if (this.idb && !this.useMemoryFallback) {
      try {
        await this.idb.add(operation);
      } catch (error) {
        console.warn('[OfflineQueue] Failed to persist operation to IndexedDB:', error);
        // Don't fall back to memory mode here, just log the error
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
        console.error('[OfflineQueue] Error processing queued operation:', error);
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

    if (this.idb && !this.useMemoryFallback) {
      try {
        await this.idb.remove(id);
      } catch (error) {
        console.warn('[OfflineQueue] Failed to remove operation from IndexedDB:', error);
      }
    }

    this.notifyListeners();
  }

  async size(): Promise<number> {
    await this.init();
    return this.memoryQueue.length;
  }

  sizeSync(): number {
    return this.memoryQueue.length;
  }

  async clear(): Promise<void> {
    this.memoryQueue = [];

    if (this.idb && !this.useMemoryFallback) {
      try {
        await this.idb.clear();
      } catch (error) {
        console.warn('[OfflineQueue] Failed to clear IndexedDB:', error);
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
        console.error('[OfflineQueue] Error in queue listener:', error);
      }
    });
  }

  // Development safeguards
  getDebugInfo(): {
    isInitialized: boolean;
    useMemoryFallback: boolean;
    queueSize: number;
    idbRetryAttempts: number;
  } {
    return {
      isInitialized: this.isInitialized,
      useMemoryFallback: this.useMemoryFallback,
      queueSize: this.memoryQueue.length,
      idbRetryAttempts: this.idbRetryAttempts
    };
  }
}

// Export default instance
export const offlineQueue = new OfflineQueue();