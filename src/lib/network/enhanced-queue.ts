/**
 * Enhanced Network Queue Management
 * Handles offline operations and network recovery with improved reliability
 */

interface QueueItem {
  id: string;
  operation: () => Promise<any>;
  priority: 'low' | 'medium' | 'high';
  attempts: number;
  maxAttempts: number;
  timestamp: number;
  data?: any;
  onSuccess?: (result: any) => void;
  onFailure?: (error: Error) => void;
}

class EnhancedNetworkQueue {
  private static instance: EnhancedNetworkQueue;
  private queue: Map<string, QueueItem> = new Map();
  private processing = false;
  private maxQueueSize = 100;
  private processingTimeout?: NodeJS.Timeout;

  static getInstance(): EnhancedNetworkQueue {
    if (!EnhancedNetworkQueue.instance) {
      EnhancedNetworkQueue.instance = new EnhancedNetworkQueue();
    }
    return EnhancedNetworkQueue.instance;
  }

  /**
   * Add operation to queue
   */
  enqueue(
    id: string,
    operation: () => Promise<any>,
    options: Partial<Pick<QueueItem, 'priority' | 'maxAttempts' | 'data' | 'onSuccess' | 'onFailure'>> = {}
  ): void {
    // Check queue size limit
    if (this.queue.size >= this.maxQueueSize) {
      // Remove oldest low priority items
      this.removeOldestLowPriorityItems(10);
    }

    const queueItem: QueueItem = {
      id,
      operation,
      priority: options.priority || 'medium',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      timestamp: Date.now(),
      data: options.data,
      onSuccess: options.onSuccess,
      onFailure: options.onFailure
    };

    this.queue.set(id, queueItem);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NetworkQueue] Enqueued: ${id}, Queue size: ${this.queue.size}`);
    }
  }

  /**
   * Remove operation from queue
   */
  dequeue(id: string): boolean {
    const removed = this.queue.delete(id);
    if (removed && process.env.NODE_ENV === 'development') {
      console.log(`[NetworkQueue] Dequeued: ${id}, Queue size: ${this.queue.size}`);
    }
    return removed;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    size: number;
    processing: boolean;
    items: Array<{
      id: string;
      priority: string;
      attempts: number;
      maxAttempts: number;
      timestamp: number;
    }>;
  } {
    return {
      size: this.queue.size,
      processing: this.processing,
      items: Array.from(this.queue.values()).map(item => ({
        id: item.id,
        priority: item.priority,
        attempts: item.attempts,
        maxAttempts: item.maxAttempts,
        timestamp: item.timestamp
      }))
    };
  }

  /**
   * Process queue when online
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) {
      return;
    }

    this.processing = true;

    try {
      // Sort by priority and timestamp
      const items = Array.from(this.queue.values()).sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return a.timestamp - b.timestamp; // Older items first
      });

      // Process items sequentially to avoid overwhelming the server
      for (const item of items) {
        if (!this.queue.has(item.id)) {
          continue; // Item was removed during processing
        }

        try {
          const result = await this.executeWithTimeout(item.operation, 30000); // 30s timeout
          
          // Success - remove from queue
          this.queue.delete(item.id);
          item.onSuccess?.(result);
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[NetworkQueue] Processed successfully: ${item.id}`);
          }
          
        } catch (error) {
          item.attempts++;
          
          if (item.attempts >= item.maxAttempts) {
            // Max attempts reached - remove from queue
            this.queue.delete(item.id);
            item.onFailure?.(error as Error);
            
            if (process.env.NODE_ENV === 'development') {
              console.error(`[NetworkQueue] Max attempts reached for: ${item.id}`, error);
            }
          } else {
            // Update attempt count
            this.queue.set(item.id, item);
            
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[NetworkQueue] Retry ${item.attempts}/${item.maxAttempts} for: ${item.id}`, error);
            }
          }
        }

        // Small delay between requests to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } finally {
      this.processing = false;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>, 
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Remove oldest low priority items
   */
  private removeOldestLowPriorityItems(count: number): void {
    const lowPriorityItems = Array.from(this.queue.entries())
      .filter(([_, item]) => item.priority === 'low')
      .sort(([_, a], [__, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    for (const [id] of lowPriorityItems) {
      this.queue.delete(id);
    }

    if (lowPriorityItems.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[NetworkQueue] Removed ${lowPriorityItems.length} old low-priority items`);
    }
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    const size = this.queue.size;
    this.queue.clear();
    
    if (size > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[NetworkQueue] Cleared ${size} items`);
    }
  }

  /**
   * Retry failed operations
   */
  retryFailed(): void {
    const failedItems = Array.from(this.queue.values())
      .filter(item => item.attempts > 0)
      .map(item => ({ ...item, attempts: 0 }));

    failedItems.forEach(item => {
      this.queue.set(item.id, item);
    });

    if (failedItems.length > 0) {
      this.processQueue();
    }
  }
}

// Export singleton instance
export const networkQueue = EnhancedNetworkQueue.getInstance();

// Utility functions
export const enqueueOperation = (
  id: string,
  operation: () => Promise<any>,
  options?: Parameters<typeof networkQueue.enqueue>[2]
) => {
  networkQueue.enqueue(id, operation, options);
};

export const getQueueSize = () => networkQueue.getQueueSize();

export const processQueue = () => networkQueue.processQueue();

export const clearQueue = () => networkQueue.clear();

export const getQueueStatus = () => networkQueue.getStatus();

export default EnhancedNetworkQueue;