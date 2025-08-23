
interface LongTaskEntry {
  name: string;
  duration: number;
  startTime: number;
  attribution?: PerformanceEventTiming[];
}

class LongTaskMonitor {
  private observer: PerformanceObserver | null = null;
  private isEnabled = false;
  private longTasks: LongTaskEntry[] = [];
  private listeners: ((task: LongTaskEntry) => void)[] = [];

  constructor() {
    // Only enable in development by default
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  enable() {
    if (this.isEnabled && this.observer) return;

    if (!('PerformanceObserver' in globalThis)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as any[];
        
        entries.forEach((entry) => {
          if (entry.entryType === 'longtask') {
            const longTask: LongTaskEntry = {
              name: entry.name || 'unknown',
              duration: entry.duration,
              startTime: entry.startTime,
              attribution: entry.attribution
            };

            this.longTasks.push(longTask);
            this.notifyListeners(longTask);

            // Log in development
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `🐌 Long Task detected: ${longTask.name} took ${longTask.duration.toFixed(2)}ms`,
                longTask
              );
            }
          }
        });
      });

      this.observer.observe({ entryTypes: ['longtask'] });
      this.isEnabled = true;
      
      console.log('Long Task monitor enabled');
    } catch (error) {
      console.error('Failed to enable Long Task monitoring:', error);
    }
  }

  disable() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isEnabled = false;
  }

  onLongTask(callback: (task: LongTaskEntry) => void) {
    this.listeners.push(callback);
    
    // Return cleanup function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(task: LongTaskEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(task);
      } catch (error) {
        console.error('Long task listener error:', error);
      }
    });
  }

  getLongTasks(): readonly LongTaskEntry[] {
    return [...this.longTasks];
  }

  getStats() {
    const tasks = this.longTasks;
    if (tasks.length === 0) {
      return {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        maxDuration: 0,
        minDuration: 0
      };
    }

    const durations = tasks.map(t => t.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: tasks.length,
      totalDuration,
      averageDuration: totalDuration / tasks.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations)
    };
  }

  clear() {
    this.longTasks = [];
  }
}

// Global instance
export const longTaskMonitor = new LongTaskMonitor();

// Auto-enable in development
if (process.env.NODE_ENV === 'development') {
  longTaskMonitor.enable();
}

// React hook for long task monitoring
import React from 'react';

export const useLongTaskMonitor = () => {
  const [longTasks, setLongTasks] = React.useState<readonly LongTaskEntry[]>([]);
  
  React.useEffect(() => {
    // Get initial tasks
    setLongTasks(longTaskMonitor.getLongTasks());

    // Listen for new tasks
    const cleanup = longTaskMonitor.onLongTask(() => {
      setLongTasks(longTaskMonitor.getLongTasks());
    });

    return cleanup;
  }, []);

  return {
    longTasks,
    stats: longTaskMonitor.getStats(),
    clear: () => {
      longTaskMonitor.clear();
      setLongTasks([]);
    }
  };
};

// Utility to wrap functions with long task detection
export const withLongTaskDetection = <T extends (...args: any[]) => any>(
  fn: T,
  name: string = fn.name || 'anonymous'
): T => {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    
    try {
      const result = fn(...args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          if (duration > 50) {
            console.warn(`Async ${name} took ${duration.toFixed(2)}ms`);
          }
        }) as ReturnType<T>;
      }
      
      const duration = performance.now() - start;
      if (duration > 50) {
        console.warn(`${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }) as T;
};
