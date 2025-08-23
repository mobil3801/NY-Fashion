import React from 'react';

/**
 * Modern page lifecycle helper utility
 * Replaces deprecated unload events with pagehide, visibilitychange, and navigator.sendBeacon
 */

export interface LifecycleConfig {
  onPageHide?: (event: PageTransitionEvent) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  onBeforeUnload?: (event: BeforeUnloadEvent) => void;
  sendBeacon?: {
    url: string;
    data: BodyInit;
  };
}

export class PageLifecycleManager {
  private config: LifecycleConfig;
  private isVisible: boolean = true;
  private listeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];

  constructor(config: LifecycleConfig) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    // Handle page visibility changes
    if (this.config.onVisibilityChange) {
      const visibilityHandler = () => {
        this.isVisible = document.visibilityState === 'visible';
        this.config.onVisibilityChange?.(this.isVisible);
      };
      
      this.addListener(document, 'visibilitychange', visibilityHandler);
    }

    // Handle page hide (better than unload)
    if (this.config.onPageHide || this.config.sendBeacon) {
      const pageHideHandler = (event: PageTransitionEvent) => {
        this.config.onPageHide?.(event);
        
        // Send beacon data if configured
        if (this.config.sendBeacon && navigator.sendBeacon) {
          navigator.sendBeacon(this.config.sendBeacon.url, this.config.sendBeacon.data);
        }
      };
      
      this.addListener(window, 'pagehide', pageHideHandler);
    }

    // Fallback for beforeunload if needed (use sparingly)
    if (this.config.onBeforeUnload) {
      const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        this.config.onBeforeUnload?.(event);
      };
      
      this.addListener(window, 'beforeunload', beforeUnloadHandler);
    }
  }

  private addListener(element: EventTarget, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
  }

  public destroy(): void {
    // Clean up all event listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  public sendBeaconData(url: string, data: BodyInit): boolean {
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(url, data);
    }
    return false;
  }

  public get pageVisible(): boolean {
    return this.isVisible;
  }
}

// Utility hook for React components
export function usePageLifecycle(config: LifecycleConfig) {
  const managerRef = React.useRef<PageLifecycleManager | null>(null);

  React.useEffect(() => {
    managerRef.current = new PageLifecycleManager(config);
    
    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  return {
    sendBeacon: (url: string, data: BodyInit) => managerRef.current?.sendBeaconData(url, data) || false,
    isVisible: managerRef.current?.pageVisible || true,
  };
}

// Simple function-based API for non-React usage
export function setupPageLifecycle(config: LifecycleConfig): PageLifecycleManager {
  return new PageLifecycleManager(config);
}

export default PageLifecycleManager;
