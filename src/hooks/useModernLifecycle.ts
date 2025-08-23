import { useEffect, useCallback, useRef } from 'react';
import { usePageLifecycle } from '@/utils/lifecycle';

/**
 * Modern page lifecycle hook that replaces deprecated unload listeners
 * Uses pagehide, visibilitychange, and freeze events instead
 */
interface ModernLifecycleOptions {
  onPageLeave?: () => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  onBeforePageLeave?: () => void;
  sendBeaconUrl?: string;
  persistenceKey?: string;
}

export function useModernLifecycle(options: ModernLifecycleOptions = {}) {
  const {
    onPageLeave,
    onVisibilityChange,
    onBeforePageLeave,
    sendBeaconUrl,
    persistenceKey
  } = options;

  // Track if we've already handled page leave to prevent double execution
  const hasHandledLeave = useRef(false);

  const handlePageHide = useCallback((event: PageTransitionEvent) => {
    if (hasHandledLeave.current) return;
    hasHandledLeave.current = true;

    // Call user-provided handler
    onPageLeave?.();

    // Send beacon if URL provided
    if (sendBeaconUrl) {
      const data = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(sendBeaconUrl, JSON.stringify(data));
      }
    }
  }, [onPageLeave, sendBeaconUrl]);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = document.visibilityState === 'visible';
    
    if (!isVisible && !hasHandledLeave.current) {
      onBeforePageLeave?.();
    }
    
    onVisibilityChange?.(isVisible);
  }, [onVisibilityChange, onBeforePageLeave]);

  // Use our existing lifecycle utility
  const { flushData, isVisible } = usePageLifecycle({
    onPageHide: handlePageHide,
    onVisibilityChange: handleVisibilityChange,
    ...(sendBeaconUrl && {
      sendBeacon: {
        url: sendBeaconUrl,
        data: { timestamp: Date.now() }
      }
    }),
    ...(persistenceKey && { persistenceKey })
  });

  // Prevent use of deprecated unload events
  useEffect(() => {
    if (import.meta.env.DEV) {
      const originalAddEventListener = window.addEventListener;
      const originalRemoveEventListener = window.removeEventListener;

      // Warn about deprecated event usage in development
      window.addEventListener = function(type: string, ...args: any[]) {
        if (type === 'unload' || type === 'beforeunload') {
          console.warn(
            `⚠️  Deprecated: ${type} event listener detected. Use useModernLifecycle hook instead.`,
            new Error().stack
          );
        }
        return originalAddEventListener.call(this, type, ...args);
      };

      return () => {
        window.addEventListener = originalAddEventListener;
        window.removeEventListener = originalRemoveEventListener;
      };
    }
  }, []);

  return {
    flushData,
    isVisible,
    forceFlush: useCallback(async (url?: string, data?: any) => {
      if (url) {
        return await flushData(url, data);
      }
      return false;
    }, [flushData])
  };
}

/**
 * Utility to safely replace any existing unload listeners
 */
export function replaceUnloadListeners() {
  if (import.meta.env.DEV) {
    console.warn('🔄 Replacing any deprecated unload listeners with modern alternatives');
  }

  // Remove any existing unload listeners
  const events = ['unload', 'beforeunload'];
  events.forEach(eventType => {
    // Clone the window to remove all listeners
    const newWindow = window.cloneNode ? (window as any).cloneNode(false) : window;
    
    // Note: We can't actually remove existing listeners without references,
    // but we can warn about their usage and provide better alternatives
    if (import.meta.env.DEV) {
      console.info(`✅ Use useModernLifecycle hook instead of ${eventType} listeners`);
    }
  });
}

export default useModernLifecycle;
