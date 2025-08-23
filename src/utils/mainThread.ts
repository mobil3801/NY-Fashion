
// PostTask API shim with MessageChannel/setTimeout fallback
interface PostTaskOptions {
  priority?: 'user-blocking' | 'user-visible' | 'background';
  delay?: number;
}

interface TaskController {
  abort(): void;
}

class SimpleTaskController implements TaskController {
  private aborted = false;
  private cleanup?: () => void;

  constructor(cleanup?: () => void) {
    this.cleanup = cleanup;
  }

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    this.cleanup?.();
  }

  get isAborted() {
    return this.aborted;
  }
}

// Check for native PostTask API support
const hasNativeScheduler = typeof globalThis.scheduler?.postTask === 'function';

export const scheduleTask = (
callback: () => void | Promise<void>,
options: PostTaskOptions = {})
: TaskController => {
  const { priority = 'user-visible', delay = 0 } = options;

  // Use native PostTask if available
  if (hasNativeScheduler) {
    try {
      const controller = globalThis.scheduler.postTask(callback, { priority, delay });
      return {
        abort: () => controller.abort()
      };
    } catch (error) {
      console.warn('Native scheduler failed, falling back:', error);
    }
  }

  // MessageChannel fallback for immediate macro-task scheduling
  if (delay === 0 && priority !== 'background') {
    const channel = new MessageChannel();
    const controller = new SimpleTaskController();

    channel.port2.onmessage = () => {
      if (controller.isAborted) return;

      try {
        callback();
      } catch (error) {
        console.error('Scheduled task error:', error);
      } finally {
        channel.port1.close();
        channel.port2.close();
      }
    };

    // Schedule immediately
    channel.port1.postMessage(null);

    return controller;
  }

  // setTimeout fallback
  const timeoutId = setTimeout(() => {
    if (controller.isAborted) return;

    try {
      callback();
    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  }, delay);

  const controller = new SimpleTaskController(() => {
    clearTimeout(timeoutId);
  });

  return controller;
};

// Helper for deferring expensive operations
export const deferExpensiveWork = (
work: () => void,
priority: PostTaskOptions['priority'] = 'background')
: TaskController => {
  return scheduleTask(work, { priority, delay: 0 });
};

// Helper for batching DOM operations
export const batchDOMWrites = (writes: (() => void)[]): TaskController => {
  return scheduleTask(() => {
    // Batch all DOM writes together
    writes.forEach((write) => {
      try {
        write();
      } catch (error) {
        console.error('Batched DOM write error:', error);
      }
    });
  }, { priority: 'user-visible' });
};

// Performance measurement utilities
export const measureMainThreadTime = async <T,>(
name: string,
operation: () => T | Promise<T>)
: Promise<T> => {
  const start = performance.now();

  try {
    const result = await operation();
    const duration = performance.now() - start;

    if (duration > 16) {
      console.warn(`Long main-thread task detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    performance.mark(`${name}-end`);
    performance.measure(name, { start, end: performance.now() });

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Task failed after ${duration.toFixed(2)}ms:`, name, error);
    throw error;
  }
};

// Check if we're in a long task
export const isInLongTask = (): boolean => {
  // Simple heuristic: if we're more than 50ms into current task
  const now = performance.now();
  return now % 1000 > 50; // Rough estimate
};

// Yield control to browser if we've been running too long
export const yieldToMain = (): Promise<void> => {
  return new Promise((resolve) => {
    scheduleTask(resolve, { priority: 'user-visible' });
  });
};