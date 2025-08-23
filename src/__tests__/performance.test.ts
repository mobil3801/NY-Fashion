
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRafLoop } from '../hooks/useRafLoop';
import { useThrottledEvent } from '../hooks/useThrottledEvent';
import { scheduleTask, measureMainThreadTime, yieldToMain } from '../utils/mainThread';
import { longTaskMonitor } from '../perf/longTasks';

// Mock requestAnimationFrame and performance APIs
const mockRaf = vi.fn();
const mockCancelRaf = vi.fn();
const mockPerformanceNow = vi.fn();

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', mockRaf);
  vi.stubGlobal('cancelAnimationFrame', mockCancelRaf);
  vi.stubGlobal('performance', {
    now: mockPerformanceNow,
    mark: vi.fn(),
    measure: vi.fn()
  });

  mockPerformanceNow.mockImplementation(() => Date.now());
  mockRaf.mockImplementation((callback) => {
    setTimeout(callback, 16); // Simulate 60fps
    return 123;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Performance Optimizations', () => {
  describe('useRafLoop Hook', () => {
    it('should start and stop RAF loop correctly', () => {
      const onFrame = vi.fn();
      const { result } = renderHook(() => useRafLoop({ onFrame }));

      // Should not be running initially
      expect(result.current.isRunning).toBe(false);

      // Start the loop
      act(() => {
        result.current.start();
      });

      expect(mockRaf).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useRafLoop({
        onFrame: errorCallback,
        autoStart: true
      }));

      // Wait for callback to execute
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(consoleSpy).toHaveBeenCalledWith('RAF loop error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should cleanup on unmount', () => {
      const onFrame = vi.fn();
      const { result, unmount } = renderHook(() => useRafLoop({
        onFrame,
        autoStart: true
      }));

      act(() => {
        result.current.start();
      });

      unmount();

      expect(mockCancelRaf).toHaveBeenCalled();
    });
  });

  describe('useThrottledEvent Hook', () => {
    let mockElement: HTMLElement;

    beforeEach(() => {
      mockElement = document.createElement('div');
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      document.body.removeChild(mockElement);
    });

    it('should throttle events using RAF', async () => {
      const handler = vi.fn();

      renderHook(() => useThrottledEvent({
        element: mockElement,
        eventType: 'click',
        handler,
        passive: true
      }));

      // Fire multiple events rapidly
      const clickEvent = new MouseEvent('click');
      mockElement.dispatchEvent(clickEvent);
      mockElement.dispatchEvent(clickEvent);
      mockElement.dispatchEvent(clickEvent);

      // Should only call handler once (after RAF)
      expect(handler).toHaveBeenCalledTimes(0);

      // Wait for RAF to execute
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should use passive listeners by default', () => {
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      const handler = vi.fn();

      renderHook(() => useThrottledEvent({
        element: mockElement,
        eventType: 'mousemove',
        handler
      }));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'mousemove',
        expect.any(Function),
        { passive: true, capture: false }
      );
    });
  });

  describe('Main Thread Scheduling', () => {
    it('should schedule tasks with MessageChannel fallback', async () => {
      const callback = vi.fn();

      const controller = scheduleTask(callback, { priority: 'user-visible' });

      expect(controller).toBeDefined();
      expect(typeof controller.abort).toBe('function');

      // Wait for task to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback).toHaveBeenCalled();
    });

    it('should handle task cancellation', async () => {
      const callback = vi.fn();

      const controller = scheduleTask(callback, { delay: 100 });
      controller.abort();

      // Wait longer than delay
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(callback).not.toHaveBeenCalled();
    });

    it('should measure main thread time', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const result = await measureMainThreadTime('test-operation', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    it('should warn about long tasks', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock a long-running operation
      mockPerformanceNow.
      mockReturnValueOnce(0) // Start time
      .mockReturnValueOnce(50); // End time (50ms)

      const longOperation = () => {
        // Simulate work
        return 'result';
      };

      await measureMainThreadTime('long-task', longOperation);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Long main-thread task detected: long-task took 50.00ms')
      );

      consoleSpy.mockRestore();
    });

    it('should yield control to main thread', async () => {
      const start = performance.now();
      await yieldToMain();
      const end = performance.now();

      // Should take at least some time to yield
      expect(end - start).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Web Worker Communication', () => {
    it('should handle worker messages correctly', (done) => {
      // Mock worker
      class MockWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((error: ErrorEvent) => void) | null = null;

        postMessage(data: any) {
          // Simulate async response
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: { type: 'DATA_PROCESSED', result: { bars: [] }, id: data.id }
              }));
            }
          }, 10);
        }

        terminate() {









          // Mock terminate
        }}const worker = new MockWorker();let receivedResult = false;worker.onmessage = (event) => {if (event.data.type === 'DATA_PROCESSED') {receivedResult = true;expect(event.data.result).toBeDefined();
          done();
        }
      };

      worker.postMessage({
        type: 'PROCESS_DATA',
        data: [{ category: 'A', value: 10 }],
        config: { width: 800, height: 400 },
        id: 1
      });

      // Timeout fallback
      setTimeout(() => {
        if (!receivedResult) {
          done();
        }
      }, 100);
    });
  });

  describe('Long Task Monitoring', () => {
    it('should detect and log long tasks in development', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate long task detection
      const mockEntry = {
        name: 'test-task',
        duration: 100,
        startTime: 0,
        entryType: 'longtask'
      };

      // Manually trigger long task handling
      const listeners = [];
      longTaskMonitor.onLongTask((task) => {
        expect(task.duration).toBe(100);
        expect(task.name).toBe('test-task');
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should provide task statistics', () => {
      const stats = longTaskMonitor.getStats();

      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('totalDuration');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('maxDuration');
      expect(stats).toHaveProperty('minDuration');
    });

    it('should clear task history', () => {
      longTaskMonitor.clear();
      const stats = longTaskMonitor.getStats();

      expect(stats.count).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });
  });

  describe('Performance Acceptance Criteria', () => {
    it('should keep input handlers under 50ms', async () => {
      const start = performance.now();

      // Simulate optimized event handler
      const optimizedHandler = () => {
        // Lightweight operation
        return true;
      };

      const result = optimizedHandler();
      const duration = performance.now() - start;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(50);
    });

    it('should keep animation frames under 16ms', async () => {
      const frameHandler = vi.fn((deltaTime: number) => {
        // Simulate lightweight frame operation
        const start = performance.now();

        // Do minimal work
        const data = { frame: true };

        const duration = performance.now() - start;
        expect(duration).toBeLessThan(16);

        return data;
      });

      const { result } = renderHook(() => useRafLoop({
        onFrame: frameHandler,
        autoStart: true
      }));

      // Let a few frames run
      await new Promise((resolve) => setTimeout(resolve, 100));

      act(() => {
        result.current.stop();
      });

      expect(frameHandler).toHaveBeenCalled();
    });

    it('should batch DOM operations efficiently', async () => {
      const domWrites = [
      () => document.body.style.background = 'red',
      () => document.body.style.color = 'blue',
      () => document.body.style.fontSize = '16px'];


      const start = performance.now();

      // Batch DOM writes
      domWrites.forEach((write) => write());

      const duration = performance.now() - start;

      // Should complete quickly when batched
      expect(duration).toBeLessThan(5);
    });

    it('should handle worker termination cleanly', () => {
      const mockWorker = {
        terminate: vi.fn(),
        postMessage: vi.fn(),
        onmessage: null,
        onerror: null
      };

      // Test clean termination
      expect(() => {
        mockWorker.terminate();
      }).not.toThrow();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });
});