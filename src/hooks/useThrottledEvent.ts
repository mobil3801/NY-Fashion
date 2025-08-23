
import { useCallback, useRef, useEffect } from 'react';

interface ThrottledEventOptions<T extends Event> {
  element: HTMLElement | Window | Document | null;
  eventType: string;
  handler: (event: T) => void;
  passive?: boolean;
  capture?: boolean;
}

export const useThrottledEvent = <T extends Event>({
  element,
  eventType,
  handler,
  passive = true,
  capture = false
}: ThrottledEventOptions<T>) => {
  const rafIdRef = useRef<number | null>(null);
  const latestEventRef = useRef<T | null>(null);
  const handlerRef = useRef(handler);

  // Keep handler reference stable
  handlerRef.current = handler;

  const throttledHandler = useCallback((event: T) => {
    latestEventRef.current = event;

    // Cancel previous RAF if still pending
    if (rafIdRef.current !== null) {
      return; // Already scheduled
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      
      if (latestEventRef.current) {
        try {
          handlerRef.current(latestEventRef.current);
        } catch (error) {
          console.error('Throttled event handler error:', error);
        }
        latestEventRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!element) return;

    const options = {
      passive,
      capture
    };

    element.addEventListener(eventType, throttledHandler as EventListener, options);

    return () => {
      element.removeEventListener(eventType, throttledHandler as EventListener, options);
      
      // Cancel pending RAF on cleanup
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [element, eventType, throttledHandler, passive, capture]);

  // Cleanup function for manual cleanup if needed
  const cleanup = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    latestEventRef.current = null;
  }, []);

  return { cleanup };
};

// Higher-order hook for common event types
export const useThrottledClick = (
  element: HTMLElement | null,
  handler: (event: MouseEvent) => void,
  options?: Omit<ThrottledEventOptions<MouseEvent>, 'element' | 'eventType' | 'handler'>
) => {
  return useThrottledEvent({
    element,
    eventType: 'click',
    handler,
    ...options
  });
};

export const useThrottledMouseMove = (
  element: HTMLElement | null,
  handler: (event: MouseEvent) => void,
  options?: Omit<ThrottledEventOptions<MouseEvent>, 'element' | 'eventType' | 'handler'>
) => {
  return useThrottledEvent({
    element,
    eventType: 'mousemove',
    handler,
    ...options
  });
};

export const useThrottledMouseDown = (
  element: HTMLElement | null,
  handler: (event: MouseEvent) => void,
  options?: Omit<ThrottledEventOptions<MouseEvent>, 'element' | 'eventType' | 'handler'>
) => {
  return useThrottledEvent({
    element,
    eventType: 'mousedown',
    handler,
    ...options
  });
};
