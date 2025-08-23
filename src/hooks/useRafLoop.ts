
import { useCallback, useRef, useEffect } from 'react';

interface RafLoopOptions {
  onFrame: (deltaTime: number, timestamp: number) => void;
  autoStart?: boolean;
}

export const useRafLoop = ({ onFrame, autoStart = false }: RafLoopOptions) => {
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const stableCallbackRef = useRef(onFrame);

  // Keep callback reference stable
  stableCallbackRef.current = onFrame;

  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    try {
      stableCallbackRef.current(deltaTime, timestamp);
    } catch (error) {
      console.error('RAF loop error:', error);
    }

    if (isRunningRef.current) {
      rafIdRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const start = useCallback(() => {
    if (isRunningRef.current) return;
    
    isRunningRef.current = true;
    lastTimeRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (!isRunningRef.current) return;
    
    isRunningRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (isRunningRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      start();
    }
    
    // Cleanup on unmount
    return stop;
  }, [autoStart, start, stop]);

  return {
    start,
    stop,
    toggle,
    isRunning: isRunningRef.current
  };
};
