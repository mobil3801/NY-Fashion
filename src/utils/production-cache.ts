
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
}

class ProductionCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, memoryUsage: 0, hitRate: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      compressionThreshold: 10000, // 10KB
      ...config
    };

    this.startCleanup();
    this.initializePerformanceMonitoring();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private initializePerformanceMonitoring(): void {
    // Monitor cache performance every 30 seconds
    setInterval(() => {
      const stats = this.getStats();
      if (stats.hitRate < 0.7 && stats.size > 100) {
        logger.logWarn('Low cache hit rate detected', {
          hitRate: stats.hitRate,
          size: stats.size,
          memoryUsage: stats.memoryUsage
        });
      }
    }, 30000);
  }

  set<T>(key: string, data: T, ttl?: number): void {
    try {
      // Check size limits
      if (this.cache.size >= this.config.maxSize) {
        this.evictLRU();
      }

      const dataSize = this.calculateSize(data);
      const entry: CacheEntry<T> = {
        data: this.shouldCompress(data) ? this.compress(data) : data,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
        hits: 0,
        size: dataSize
      };

      this.cache.set(key, entry);
      this.updateStats();

      logger.logDebug('Cache entry set', {
        key: key.substring(0, 50),
        size: dataSize,
        ttl: entry.ttl,
        compressed: this.shouldCompress(data)
      });
    } catch (error) {
      logger.logError('Cache set failed', { key, error });
    }
  }

  get<T>(key: string): T | null {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        this.updateStats();
        return null;
      }

      // Check expiration
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.stats.misses++;
        this.updateStats();
        return null;
      }

      // Update hit count and stats
      entry.hits++;
      this.stats.hits++;
      this.updateStats();

      // Decompress if needed
      const data = this.isCompressed(entry.data) ? this.decompress(entry.data) : entry.data;

      return data as T;
    } catch (error) {
      logger.logError('Cache get failed', { key, error });
      this.stats.misses++;
      this.updateStats();
      return null;
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.updateStats();
    return result;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, memoryUsage: 0, hitRate: 0 };
    logger.logInfo('Cache cleared');
  }

  // Bulk operations
  mget<T>(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();

    keys.forEach((key) => {
      const value = this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    });

    return results;
  }

  mset<T>(entries: Array<{key: string;data: T;ttl?: number;}>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  // Cache warming
  warm<T>(key: string, dataProvider: () => Promise<T>, ttl?: number): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if already cached
        const cached = this.get<T>(key);
        if (cached !== null) {
          resolve(cached);
          return;
        }

        // Fetch and cache
        const data = await dataProvider();
        this.set(key, data, ttl);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Cache-aside pattern
  async getOrSet<T>(
  key: string,
  dataProvider: () => Promise<T>,
  ttl?: number)
  : Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from data source
    try {
      const data = await dataProvider();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      logger.logError('Cache getOrSet failed', { key, error });
      throw error;
    }
  }

  // Invalidation patterns
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.updateStats();
    logger.logInfo('Cache pattern invalidated', { pattern, count });
    return count;
  }

  invalidateByTag(tag: string): number {
    return this.invalidatePattern(`.*:${tag}:.*`);
  }

  // Cleanup and maintenance
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    this.updateStats();

    if (expiredCount > 0) {
      logger.logDebug('Cache cleanup completed', {
        expiredEntries: expiredCount,
        remainingEntries: this.cache.size
      });
    }
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Find least recently used entry (lowest hit count, oldest timestamp)
    let lruKey = '';
    let lruScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000;
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      logger.logDebug('LRU cache eviction', { evictedKey: lruKey });
    }
  }

  private shouldCompress<T>(data: T): boolean {
    const size = this.calculateSize(data);
    return size > this.config.compressionThreshold;
  }

  private compress<T>(data: T): string {
    try {
      return 'compressed:' + btoa(JSON.stringify(data));
    } catch (error) {
      logger.logWarn('Compression failed', error);
      return data as any;
    }
  }

  private decompress(data: string): any {
    try {
      if (typeof data === 'string' && data.startsWith('compressed:')) {
        return JSON.parse(atob(data.substring(11)));
      }
      return data;
    } catch (error) {
      logger.logWarn('Decompression failed', error);
      return data;
    }
  }

  private isCompressed(data: any): boolean {
    return typeof data === 'string' && data.startsWith('compressed:');
  }

  private calculateSize<T>(data: T): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 0;
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = Array.from(this.cache.values()).
    reduce((sum, entry) => sum + (entry.size || 0), 0);

    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // Public API
  getStats(): CacheStats {
    return { ...this.stats };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getSize(): number {
    return this.cache.size;
  }

  getMemoryUsage(): number {
    return this.stats.memoryUsage;
  }

  // Export/Import for debugging
  export(): string {
    const data = {
      cache: Array.from(this.cache.entries()),
      stats: this.stats,
      config: this.config,
      timestamp: Date.now()
    };
    return JSON.stringify(data, null, 2);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    logger.logInfo('Cache destroyed');
  }
}

// Specialized cache instances
export const productCache = new ProductionCache({
  maxSize: 500,
  defaultTTL: 10 * 60 * 1000, // 10 minutes for products
  compressionThreshold: 5000
});

export const inventoryCache = new ProductionCache({
  maxSize: 300,
  defaultTTL: 2 * 60 * 1000, // 2 minutes for inventory (more volatile)
  compressionThreshold: 3000
});

export const userCache = new ProductionCache({
  maxSize: 200,
  defaultTTL: 30 * 60 * 1000, // 30 minutes for user data
  compressionThreshold: 2000
});

export const analyticsCache = new ProductionCache({
  maxSize: 100,
  defaultTTL: 60 * 60 * 1000, // 1 hour for analytics
  compressionThreshold: 10000
});

// Main cache instance
export const globalCache = new ProductionCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000,
  compressionThreshold: 10000
});

export default globalCache;