
import productionApi from '@/services/api';
import PRODUCTION_CONFIG from '@/config/production';
import { logger, logDatabaseOperation, logBusinessMetric } from './production-logger';
import { enhancedToast } from './enhanced-toast';

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
  key: string;
}

interface SyncStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  lastSyncTime: string;
  isOnline: boolean;
}

class DataSyncManager {
  private syncQueue: Map<string, SyncOperation> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  
  // Configuration
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRY_COUNT = 5;
  private readonly CACHE_DEFAULT_TTL = PRODUCTION_CONFIG.performance.cacheTimeout;
  private readonly BATCH_SIZE = 10;

  constructor() {
    this.setupEventListeners();
    this.startSyncScheduler();
    this.loadPersistedQueue();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.info('Connection restored, resuming sync', {}, 'CONNECTION_RESTORED', 'SYNC');
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.warn('Connection lost, queuing operations', {}, 'CONNECTION_LOST', 'SYNC');
    });

    window.addEventListener('beforeunload', () => {
      this.persistQueue();
    });

    // Visibility API - sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.triggerSync();
      }
    });
  }

  private startSyncScheduler() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.syncQueue.size > 0) {
        this.triggerSync();
      }
    }, this.SYNC_INTERVAL);
  }

  // Cache Management
  setCache<T>(key: string, data: T, ttl: number = this.CACHE_DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
      key,
    };
    
    this.cache.set(key, entry);
    logBusinessMetric('cache_set', 1, 'count', 'CACHING', { key, size: JSON.stringify(data).length });
  }

  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logBusinessMetric('cache_miss', 1, 'count', 'CACHING', { key });
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      logBusinessMetric('cache_expired', 1, 'count', 'CACHING', { key });
      return null;
    }

    logBusinessMetric('cache_hit', 1, 'count', 'CACHING', { key });
    return entry.data as T;
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.cache) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
    
    logBusinessMetric('cache_cleared', 1, 'count', 'CACHING', { pattern });
  }

  // Queue Management
  queueOperation(
    type: SyncOperation['type'],
    table: string,
    data: any,
    optimisticId?: string
  ): string {
    const operation: SyncOperation = {
      id: optimisticId || `${type}_${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      table,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };

    this.syncQueue.set(operation.id, operation);
    
    // Clear related cache entries
    this.clearCache(`${table}_.*`);
    
    logger.info(`Operation queued: ${type} on ${table}`, {
      operationId: operation.id,
      dataSize: JSON.stringify(data).length,
    }, 'OPERATION_QUEUED', 'SYNC');

    // Try immediate sync if online
    if (this.isOnline) {
      setTimeout(() => this.triggerSync(), 100);
    }

    return operation.id;
  }

  async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.syncQueue.size === 0) {
      return;
    }

    this.isSyncing = true;
    
    try {
      await this.processSyncQueue();
    } catch (error: any) {
      logger.error('Sync process failed', error, 'SYNC_FAILED', 'SYNC');
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncQueue(): Promise<void> {
    const pendingOperations = Array.from(this.syncQueue.values())
      .filter(op => op.status === 'pending' || (op.status === 'failed' && op.retryCount < this.MAX_RETRY_COUNT))
      .slice(0, this.BATCH_SIZE);

    if (pendingOperations.length === 0) {
      return;
    }

    logger.info(`Processing ${pendingOperations.length} sync operations`, {
      totalQueued: this.syncQueue.size,
    }, 'SYNC_BATCH_START', 'SYNC');

    const results = await Promise.allSettled(
      pendingOperations.map(operation => this.processOperation(operation))
    );

    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      const operation = pendingOperations[index];
      
      if (result.status === 'fulfilled') {
        this.syncQueue.delete(operation.id);
        successCount++;
      } else {
        operation.retryCount++;
        operation.status = 'failed';
        operation.error = result.reason?.message || 'Unknown error';
        failureCount++;

        if (operation.retryCount >= this.MAX_RETRY_COUNT) {
          logger.error(`Operation permanently failed after ${this.MAX_RETRY_COUNT} retries`, {
            operationId: operation.id,
            type: operation.type,
            table: operation.table,
            error: operation.error,
          }, 'OPERATION_PERMANENTLY_FAILED', 'SYNC');
          
          // Move to permanent failure queue or handle as needed
          this.syncQueue.delete(operation.id);
        }
      }
    });

    logBusinessMetric('sync_batch_completed', 1, 'count', 'SYNC', {
      successCount,
      failureCount,
      totalProcessed: pendingOperations.length,
    });

    if (successCount > 0) {
      this.persistQueue();
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    operation.status = 'syncing';
    
    const startTime = Date.now();
    const tableId = this.getTableId(operation.table);
    
    if (!tableId) {
      throw new Error(`Unknown table: ${operation.table}`);
    }

    try {
      switch (operation.type) {
        case 'CREATE':
          await productionApi.createRecord(tableId, operation.data);
          break;
        case 'UPDATE':
          await productionApi.updateRecord(tableId, operation.data);
          break;
        case 'DELETE':
          await productionApi.deleteRecord(tableId, operation.data.ID);
          break;
      }

      operation.status = 'completed';
      
      const duration = Date.now() - startTime;
      logDatabaseOperation(operation.type, operation.table, duration, true, {
        operationId: operation.id,
        retryCount: operation.retryCount,
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logDatabaseOperation(operation.type, operation.table, duration, false, {
        operationId: operation.id,
        retryCount: operation.retryCount,
        error: error.message,
      });
      
      throw error;
    }
  }

  private getTableId(tableName: string): number | null {
    const tableMap: Record<string, keyof typeof PRODUCTION_CONFIG.tables> = {
      'products': 'products',
      'categories': 'categories',
      'stock_movements': 'stockMovements',
      'customers': 'customers',
      'suppliers': 'suppliers',
      'purchase_orders': 'purchaseOrders',
      'employees': 'employees',
      'time_entries': 'timeEntries',
      'sales': 'sales',
      'audit_logs': 'auditLogs',
    };

    const configKey = tableMap[tableName];
    return configKey ? PRODUCTION_CONFIG.tables[configKey] : null;
  }

  // Data fetching with caching
  async fetchWithCache<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.CACHE_DEFAULT_TTL
  ): Promise<T> {
    // Try cache first
    const cached = this.getCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const startTime = Date.now();
    try {
      const data = await fetchFn();
      
      // Cache the result
      this.setCache(cacheKey, data, ttl);
      
      const duration = Date.now() - startTime;
      logBusinessMetric('cache_fetch_success', duration, 'ms', 'CACHING', { 
        cacheKey, 
        dataSize: JSON.stringify(data).length 
      });
      
      return data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logBusinessMetric('cache_fetch_failed', duration, 'ms', 'CACHING', { 
        cacheKey, 
        error: error.message 
      });
      throw error;
    }
  }

  // Optimistic updates
  performOptimisticUpdate<T>(
    cacheKey: string,
    updateFn: (data: T | null) => T,
    syncOperation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>
  ): string {
    // Update cache optimistically
    const cachedData = this.getCache<T>(cacheKey);
    const updatedData = updateFn(cachedData);
    this.setCache(cacheKey, updatedData);
    
    // Queue for sync
    const operationId = this.queueOperation(
      syncOperation.type,
      syncOperation.table,
      syncOperation.data
    );
    
    return operationId;
  }

  // Persistence
  private persistQueue(): void {
    try {
      const queueData = Array.from(this.syncQueue.entries());
      localStorage.setItem('syncQueue', JSON.stringify(queueData));
    } catch (error) {
      logger.error('Failed to persist sync queue', error, 'PERSISTENCE_FAILED', 'SYNC');
    }
  }

  private loadPersistedQueue(): void {
    try {
      const savedQueue = localStorage.getItem('syncQueue');
      if (savedQueue) {
        const queueData: [string, SyncOperation][] = JSON.parse(savedQueue);
        this.syncQueue = new Map(queueData);
        
        // Reset failed operations to pending for retry
        for (const [id, operation] of this.syncQueue) {
          if (operation.status === 'syncing') {
            operation.status = 'pending';
          }
        }
        
        logger.info(`Loaded ${this.syncQueue.size} operations from persistence`, {}, 'QUEUE_LOADED', 'SYNC');
      }
    } catch (error) {
      logger.error('Failed to load persisted sync queue', error, 'PERSISTENCE_LOAD_FAILED', 'SYNC');
      localStorage.removeItem('syncQueue');
    }
  }

  // Statistics
  getSyncStats(): SyncStats {
    const operations = Array.from(this.syncQueue.values());
    const completed = operations.filter(op => op.status === 'completed').length;
    const failed = operations.filter(op => op.status === 'failed').length;
    
    return {
      totalOperations: this.syncQueue.size,
      successfulOperations: completed,
      failedOperations: failed,
      lastSyncTime: new Date().toISOString(),
      isOnline: this.isOnline,
    };
  }

  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.persistQueue();
    this.cache.clear();
    this.syncQueue.clear();
  }

  // Public API for components
  async queryWithCache<T>(
    tableId: number,
    params: any,
    cacheKey?: string,
    ttl?: number
  ): Promise<{ List: T[]; VirtualCount: number }> {
    const key = cacheKey || `table_${tableId}_${JSON.stringify(params)}`;
    
    return this.fetchWithCache(
      key,
      () => productionApi.queryTable<T>(tableId, params),
      ttl
    );
  }

  async createWithOptimisticUpdate<T>(
    tableId: number,
    data: Partial<T>,
    cacheKey?: string,
    optimisticUpdateFn?: (cached: any) => any
  ): Promise<string> {
    const tableName = this.getTableNameById(tableId);
    if (!tableName) {
      throw new Error(`Unknown table ID: ${tableId}`);
    }

    // Perform optimistic update if cache key and function provided
    if (cacheKey && optimisticUpdateFn) {
      this.performOptimisticUpdate(
        cacheKey,
        optimisticUpdateFn,
        { type: 'CREATE', table: tableName, data }
      );
    }

    // Queue the operation
    return this.queueOperation('CREATE', tableName, data);
  }

  private getTableNameById(tableId: number): string | null {
    for (const [key, value] of Object.entries(PRODUCTION_CONFIG.tables)) {
      if (value === tableId) {
        return key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      }
    }
    return null;
  }
}

// Create singleton instance
export const dataSyncManager = new DataSyncManager();

// Convenience functions
export const queueCreate = (table: string, data: any) => 
  dataSyncManager.queueOperation('CREATE', table, data);

export const queueUpdate = (table: string, data: any) => 
  dataSyncManager.queueOperation('UPDATE', table, data);

export const queueDelete = (table: string, data: any) => 
  dataSyncManager.queueOperation('DELETE', table, data);

export const getCachedData = <T>(key: string): T | null => 
  dataSyncManager.getCache<T>(key);

export const setCachedData = <T>(key: string, data: T, ttl?: number) => 
  dataSyncManager.setCache(key, data, ttl);

export const syncNow = () => dataSyncManager.triggerSync();

export const getSyncStatus = () => dataSyncManager.getSyncStats();

export default dataSyncManager;
