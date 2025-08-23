
import { PRODUCTION_CONFIG } from '@/config/production';
import { logger } from '@/utils/production-logger';
import { enhancedPerformanceMonitor } from '@/utils/enhanced-performance-monitor';

interface ConnectionConfig {
  maxConcurrent: number;
  timeout: number;
  retries: number;
  backoffMultiplier: number;
  compressionThreshold: number;
}

interface RequestMetrics {
  url: string;
  method: string;
  size: number;
  duration: number;
  success: boolean;
  cached: boolean;
  compressed: boolean;
}

class NetworkOptimizer {
  private activeRequests = new Map<string, AbortController>();
  private requestQueue: (() => Promise<any>)[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private isProcessingQueue = false;
  
  private config: ConnectionConfig = {
    maxConcurrent: 6,
    timeout: 30000,
    retries: 3,
    backoffMultiplier: 1.5,
    compressionThreshold: 1024 // 1KB
  };

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = { ...this.config, ...config };
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    // Clean up metrics every 5 minutes
    setInterval(() => {
      const cutoff = Date.now() - (5 * 60 * 1000);
      this.requestMetrics = this.requestMetrics.filter(m => m.duration > cutoff);
    }, 5 * 60 * 1000);
  }

  async optimizedFetch(
    url: string,
    options: RequestInit = {},
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<Response> {
    const startTime = performance.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start performance tracking
    enhancedPerformanceMonitor.startTiming(requestId, `Network: ${url}`, 'network', {
      url,
      method: options.method || 'GET',
      priority
    });

    try {
      // Check if we should queue the request
      if (this.activeRequests.size >= this.config.maxConcurrent && priority !== 'high') {
        return await this.queueRequest(() => this.executeFetch(url, options, requestId));
      }

      return await this.executeFetch(url, options, requestId);
    } catch (error) {
      enhancedPerformanceMonitor.endTiming(requestId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async executeFetch(url: string, options: RequestInit, requestId: string): Promise<Response> {
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    const startTime = performance.now();
    let response: Response;
    let attempt = 0;

    // Optimize request options
    const optimizedOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        ...(this.shouldCompress(options.body) && {
          'Content-Encoding': 'gzip'
        })
      }
    };

    // Add timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeout);

    try {
      // Implement retry logic
      while (attempt < this.config.retries) {
        try {
          response = await fetch(url, optimizedOptions);
          
          if (response.ok) {
            break;
          } else if (response.status >= 500 && attempt < this.config.retries - 1) {
            // Retry server errors
            attempt++;
            await this.delay(this.calculateBackoff(attempt));
            continue;
          } else {
            // Don't retry client errors
            break;
          }
        } catch (fetchError) {
          if (attempt === this.config.retries - 1) {
            throw fetchError;
          }
          attempt++;
          await this.delay(this.calculateBackoff(attempt));
        }
      }

      const duration = performance.now() - startTime;
      const size = this.getResponseSize(response!);

      // Record metrics
      this.requestMetrics.push({
        url,
        method: options.method || 'GET',
        size,
        duration,
        success: response!.ok,
        cached: response!.headers.get('x-cache-hit') === 'true',
        compressed: response!.headers.get('content-encoding') !== null
      });

      // End performance tracking
      enhancedPerformanceMonitor.endTiming(requestId, response!.ok);

      logger.logInfo('Network request completed', {
        url,
        method: options.method || 'GET',
        status: response!.status,
        duration,
        size,
        attempts: attempt + 1
      });

      return response!;
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
    }
  }

  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests.size < this.config.maxConcurrent) {
      const request = this.requestQueue.shift();
      if (request) {
        request().catch(console.error);
      }
    }

    this.isProcessingQueue = false;

    // Continue processing if there are more requests
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private shouldCompress(body: any): boolean {
    if (!body) return false;
    
    const size = typeof body === 'string' ? body.length : 
                  body instanceof ArrayBuffer ? body.byteLength :
                  body instanceof FormData ? 0 : // Skip FormData compression
                  JSON.stringify(body).length;

    return size > this.config.compressionThreshold;
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(this.config.backoffMultiplier, attempt), 10000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getResponseSize(response: Response): number {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  // Public API methods
  abortRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  abortAllRequests(): void {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();
    this.requestQueue.length = 0;
  }

  getNetworkStats(): {
    activeRequests: number;
    queuedRequests: number;
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    compressionRate: number;
    cacheHitRate: number;
  } {
    const recentMetrics = this.requestMetrics.filter(m => 
      Date.now() - m.duration < 60000 // Last minute
    );

    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter(m => m.success).length;
    const compressedRequests = recentMetrics.filter(m => m.compressed).length;
    const cachedRequests = recentMetrics.filter(m => m.cached).length;

    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      totalRequests,
      averageResponseTime: totalRequests > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
        : 0,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
      compressionRate: totalRequests > 0 ? (compressedRequests / totalRequests) * 100 : 0,
      cacheHitRate: totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0
    };
  }

  getSlowRequests(threshold: number = 2000): RequestMetrics[] {
    return this.requestMetrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  optimizeForMobile(): void {
    this.config.maxConcurrent = 4; // Reduce concurrent requests
    this.config.timeout = 15000; // Shorter timeout
    this.config.compressionThreshold = 512; // Lower compression threshold
    
    logger.logInfo('Network optimizer configured for mobile');
  }

  optimizeForDesktop(): void {
    this.config.maxConcurrent = 8; // More concurrent requests
    this.config.timeout = 30000; // Longer timeout
    this.config.compressionThreshold = 1024; // Standard compression threshold
    
    logger.logInfo('Network optimizer configured for desktop');
  }
}

// Global network optimizer instance
export const networkOptimizer = new NetworkOptimizer();

// Optimized fetch wrapper
export const optimizedFetch = networkOptimizer.optimizedFetch.bind(networkOptimizer);

export default networkOptimizer;
