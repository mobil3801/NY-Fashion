
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enablePersistence: boolean;
  enableCompression: boolean;
}

class EnhancedCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private readonly STORAGE_KEY = 'easysite_cache_v1';

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enablePersistence: true,
      enableCompression: false,
      ...config
    };

    this.loadPersistedCache();
    this.startCleanupInterval();
    this.setupBeforeUnload();
  }

  private loadPersistedCache(): void {
    if (!this.config.enablePersistence || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedCache = JSON.parse(stored);
        const now = Date.now();

        Object.entries(parsedCache).forEach(([key, entry]: [string, any]) => {
          if (entry.timestamp + entry.ttl > now) {
            this.cache.set(key, {
              ...entry,
              lastAccessed: now
            });
          }
        });

        logger.logDebug('Cache loaded from persistence', {
          entries: this.cache.size
        });
      }
    } catch (error) {
      logger.logWarn('Failed to load persisted cache', error);
      this.clearPersistedCache();
    }
  }

  private persistCache(): void {
    if (!this.config.enablePersistence || typeof localStorage === 'undefined') return;

    try {
      const cacheObject = Object.fromEntries(this.cache);
      const serialized = JSON.stringify(cacheObject);
      
      // Check if we're approaching localStorage limit
      if (serialized.length > 4 * 1024 * 1024) { // 4MB limit
        this.evictLeastUsed(Math.floor(this.cache.size / 2));
      }

      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      logger.logWarn('Failed to persist cache', error);
      if (error instanceof DOMException && error.code === 22) {
        // Storage quota exceeded
        this.evictLeastUsed(Math.floor(this.cache.size / 2));
      }
    }
  }

  private clearPersistedCache(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.persistCache();
      });
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp + entry.ttl < now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Enforce max size
    if (this.cache.size > this.config.maxSize) {
      const excessCount = this.cache.size - this.config.maxSize;
      this.evictLeastUsed(excessCount);
    }

    if (cleanedCount > 0 || this.cache.size > this.config.maxSize) {
      logger.logDebug('Cache cleanup completed', {
        cleanedExpired: cleanedCount,
        currentSize: this.cache.size,
        maxSize: this.config.maxSize
      });
    }
  }

  private evictLeastUsed(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => {
        // Sort by access count (ascending) then by last accessed (ascending)
        if (a[1].accessCount !== b[1].accessCount) {
          return a[1].accessCount - b[1].accessCount;
        }
        return a[1].lastAccessed - b[1].lastAccessed;
      })
      .slice(0, count);

    entries.forEach(([key]) => {
      this.cache.delete(key);
    });

    logger.logDebug('Evicted least used cache entries', { count });
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      key,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);

    // Trigger immediate cleanup if over size limit
    if (this.cache.size > this.config.maxSize) {
      this.cleanup();
    }

    logger.logDebug('Cache entry set', { key, ttl: entry.ttl });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // Check if expired
    if (entry.timestamp + entry.ttl < now) {
      this.cache.delete(key);
      logger.logDebug('Cache entry expired', { key });
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = now;

    logger.logDebug('Cache hit', { key, accessCount: entry.accessCount });
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (entry.timestamp + entry.ttl < now) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.logDebug('Cache entry deleted', { key });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.clearPersistedCache();
    logger.logDebug('Cache cleared');
  }

  // Specific methods for different data types
  setApiResponse<T>(endpoint: string, params: any, data: T, ttl: number = 5 * 60 * 1000): void {
    const key = `api_${endpoint}_${JSON.stringify(params)}`;
    this.set(key, data, ttl);
  }

  getApiResponse<T>(endpoint: string, params: any): T | null {
    const key = `api_${endpoint}_${JSON.stringify(params)}`;
    return this.get<T>(key);
  }

  setUserData<T>(userId: string, dataType: string, data: T, ttl: number = 10 * 60 * 1000): void {
    const key = `user_${userId}_${dataType}`;
    this.set(key, data, ttl);
  }

  getUserData<T>(userId: string, dataType: string): T | null {
    const key = `user_${userId}_${dataType}`;
    return this.get<T>(key);
  }

  setQueryResult<T>(query: string, params: any, data: T, ttl: number = 2 * 60 * 1000): void {
    const key = `query_${btoa(query)}_${JSON.stringify(params)}`;
    this.set(key, data, ttl);
  }

  getQueryResult<T>(query: string, params: any): T | null {
    const key = `query_${btoa(query)}_${JSON.stringify(params)}`;
    return this.get<T>(key);
  }

  // Cache statistics
  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      if (entry.timestamp + entry.ttl > now) {
        activeEntries++;
      } else {
        expiredEntries++;
      }
      totalSize += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      totalSizeBytes: totalSize,
      maxSize: this.config.maxSize,
      utilization: (this.cache.size / this.config.maxSize) * 100
    };
  }

  // Cache warming for frequently used data
  async warmCache(warmingFunction: () => Promise<Record<string, any>>): Promise<void> {
    try {
      logger.logInfo('Starting cache warming');
      const data = await warmingFunction();
      
      Object.entries(data).forEach(([key, value]) => {
        this.set(key, value, this.config.defaultTTL * 2); // Longer TTL for warmed data
      });
      
      logger.logInfo('Cache warming completed', { entriesWarmed: Object.keys(data).length });
    } catch (error) {
      logger.logError('Cache warming failed', error);
    }
  }
}

// Global cache instance
export const globalCache = new EnhancedCache({
  maxSize: PRODUCTION_CONFIG.cacheMaxSize || 1000,
  defaultTTL: PRODUCTION_CONFIG.cacheDefaultTTL || 5 * 60 * 1000,
  enablePersistence: PRODUCTION_CONFIG.enableCachePersistence !== false
});

// React hook for cache management
import React from 'react';

export const useCache = () => {
  const [cacheStats, setCacheStats] = React.useState(globalCache.getStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(globalCache.getStats());
    }, 30000); // Update stats every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    cache: globalCache,
    stats: cacheStats,
    set: globalCache.set.bind(globalCache),
    get: globalCache.get.bind(globalCache),
    delete: globalCache.delete.bind(globalCache),
    clear: globalCache.clear.bind(globalCache)
  };
};

export default globalCache;
