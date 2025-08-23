import React from 'react';

/**
 * Modern React hook for page lifecycle management
 * Uses pagehide + visibilitychange, never unload handlers
 * BFCache compatible, works on mobile Safari
 */

export interface UsePageLifecycleConfig {
  onPageHide?: (event: PageTransitionEvent) => void;
  onPageShow?: (event: PageTransitionEvent) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  persistenceKey?: string;
  autoFlushData?: {
    url: string;
    getData: () => Record<string, any>;
  };
}

export interface UsePageLifecycleReturn {
  isVisible: boolean;
  isPageActive: boolean;
  flushData: (url: string, data: Record<string, any>) => Promise<boolean>;
  getPersistedData: () => any | null;
  clearPersistedData: () => void;
}

export function usePageLifecycle(config: UsePageLifecycleConfig = {}): UsePageLifecycleReturn {
  const [isVisible, setIsVisible] = React.useState(!document.hidden);
  const [isPageActive, setIsPageActive] = React.useState(document.hasFocus());

  const listenersRef = React.useRef<Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }>>([]);

  // Cleanup function
  const cleanup = React.useCallback(() => {
    listenersRef.current.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    listenersRef.current = [];
  }, []);

  const addListener = React.useCallback((
  element: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions) =>
  {
    element.addEventListener(event, handler, options);
    listenersRef.current.push({ element, event, handler });
  }, []);

  // Flush data utility
  const flushData = React.useCallback(async (url: string, data: Record<string, any>): Promise<boolean> => {
    const payload = JSON.stringify(data);

    // Try sendBeacon first
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        return true;
      }
    }

    // Fallback to fetch with keepalive
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });
      return response.ok;
    } catch (error) {
      console.warn('Failed to flush data:', error);
      return false;
    }
  }, []);

  // Auto-flush helper
  const handleAutoFlush = React.useCallback(() => {
    if (config.autoFlushData) {
      const data = config.autoFlushData.getData();
      flushData(config.autoFlushData.url, data);
    }
  }, [config.autoFlushData, flushData]);

  // Persistence utilities
  const getPersistedData = React.useCallback(() => {
    if (!config.persistenceKey) return null;

    try {
      const stored = localStorage.getItem(config.persistenceKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to get persisted data:', error);
      return null;
    }
  }, [config.persistenceKey]);

  const clearPersistedData = React.useCallback(() => {
    if (config.persistenceKey) {
      localStorage.removeItem(config.persistenceKey);
    }
  }, [config.persistenceKey]);

  const persistData = React.useCallback((data: any) => {
    if (!config.persistenceKey) return;

    try {
      const payload = {
        timestamp: Date.now(),
        data
      };
      localStorage.setItem(config.persistenceKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist data:', error);
    }
  }, [config.persistenceKey]);

  React.useEffect(() => {
    // Page hide handler (primary - works with BFCache)
    const handlePageHide = (event: PageTransitionEvent) => {
      config.onPageHide?.(event);
      handleAutoFlush();

      if (config.persistenceKey && config.autoFlushData) {
        persistData(config.autoFlushData.getData());
      }
    };

    // Page show handler (for BFCache restoration)
    const handlePageShow = (event: PageTransitionEvent) => {
      config.onPageShow?.(event);

      // Update state when page is restored from BFCache
      setIsVisible(!document.hidden);
      setIsPageActive(document.hasFocus());
    };

    // Visibility change handler
    const handleVisibilityChange = () => {
      const wasVisible = isVisible;
      const newVisible = document.visibilityState === 'visible';

      setIsVisible(newVisible);
      config.onVisibilityChange?.(newVisible);

      // If page became hidden, flush data
      if (wasVisible && !newVisible) {
        handleAutoFlush();

        if (config.persistenceKey && config.autoFlushData) {
          persistData(config.autoFlushData.getData());
        }
      }
    };

    // Focus/blur handlers
    const handleFocus = () => {
      setIsPageActive(true);
      config.onFocus?.();
    };

    const handleBlur = () => {
      setIsPageActive(false);
      config.onBlur?.();
      handleAutoFlush(); // Flush when losing focus
    };

    // Freeze handler for mobile Safari
    const handleFreeze = () => {
      handleAutoFlush();
      if (config.persistenceKey && config.autoFlushData) {
        persistData(config.autoFlushData.getData());
      }
    };

    // Add all listeners
    addListener(window, 'pagehide', handlePageHide, { capture: true });
    addListener(window, 'pageshow', handlePageShow, { capture: true });
    addListener(document, 'visibilitychange', handleVisibilityChange);
    addListener(window, 'focus', handleFocus);
    addListener(window, 'blur', handleBlur);
    addListener(document, 'freeze', handleFreeze); // Mobile Safari BFCache

    return cleanup;
  }, [config, isVisible, handleAutoFlush, persistData, addListener, cleanup]);

  return {
    isVisible,
    isPageActive,
    flushData,
    getPersistedData,
    clearPersistedData
  };
}

export default usePageLifecycle;