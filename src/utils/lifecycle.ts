import React from 'react';

/**
 * Modern page lifecycle utility - BFCache compatible, no unload handlers
 * Uses pagehide + visibilitychange instead of deprecated unload/beforeunload
 */

export interface LifecycleConfig {
  onPageHide?: (event: PageTransitionEvent) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  onBeforeUnload?: never; // Explicitly prevent beforeunload usage
  sendBeacon?: {
    url: string;
    data: BodyInit | Record<string, any>;
  };
  persistenceKey?: string; // For localStorage persistence
}

export interface PersistenceData {
  timestamp: number;
  data: any;
}

export class PageLifecycleManager {
  private config: LifecycleConfig;
  private isVisible: boolean = !document.hidden;
  private listeners: Array<{element: EventTarget;event: string;handler: EventListener;}> = [];
  private isDestroyed = false;

  constructor(config: LifecycleConfig) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    // Primary: pagehide - fires for all navigations including BFCache
    if (this.config.onPageHide || this.config.sendBeacon || this.config.persistenceKey) {
      const pageHideHandler = (event: PageTransitionEvent) => {
        if (this.isDestroyed) return;

        this.config.onPageHide?.(event);
        this.handleDataPersistence();
      };

      this.addListener(window, 'pagehide', pageHideHandler, { capture: true });
    }

    // Secondary: visibilitychange for when page becomes hidden
    if (this.config.onVisibilityChange || this.config.sendBeacon || this.config.persistenceKey) {
      const visibilityHandler = () => {
        if (this.isDestroyed) return;

        const wasVisible = this.isVisible;
        this.isVisible = document.visibilityState === 'visible';

        if (wasVisible && !this.isVisible) {
          // Page became hidden - handle persistence
          this.handleDataPersistence();
        }

        this.config.onVisibilityChange?.(this.isVisible);
      };

      this.addListener(document, 'visibilitychange', visibilityHandler, { capture: true });
    }

    // Freeze event for mobile Safari BFCache
    const freezeHandler = () => {
      if (this.isDestroyed) return;
      this.handleDataPersistence();
    };

    this.addListener(document, 'freeze', freezeHandler, { capture: true });
  }

  private handleDataPersistence(): void {
    // Send beacon data if configured
    if (this.config.sendBeacon) {
      this.flushWithBeacon(this.config.sendBeacon.url, this.config.sendBeacon.data);
    }

    // Store to localStorage if persistence key provided
    if (this.config.persistenceKey) {
      this.persistToStorage();
    }
  }

  private addListener(
  element: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions)
  : void {
    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler });
  }

  private persistToStorage(): void {
    if (!this.config.persistenceKey) return;

    try {
      const data: PersistenceData = {
        timestamp: Date.now(),
        data: this.config.sendBeacon?.data || {}
      };
      localStorage.setItem(this.config.persistenceKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist lifecycle data:', error);
    }
  }

  public async flushWithBeacon(url: string, body: BodyInit | Record<string, any>): Promise<boolean> {
    const payload = typeof body === 'string' ?
    body :
    body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer ?
    body :
    JSON.stringify(body);

    // Try sendBeacon first (most reliable)
    if (navigator.sendBeacon) {
      const blob = payload instanceof Blob ?
      payload :
      new Blob([payload as string], { type: 'application/json' });

      if (navigator.sendBeacon(url, blob)) {
        return true;
      }
    }

    // Fallback to fetch with keepalive
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: payload,
        headers: payload instanceof FormData || payload instanceof Blob ?
        {} :
        { 'Content-Type': 'application/json' },
        keepalive: true
      });
      return response.ok;
    } catch (error) {
      console.warn('Failed to send beacon data:', error);
      return false;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;

    // Clean up all event listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  public get pageVisible(): boolean {
    return this.isVisible;
  }

  public getPersistedData(): PersistenceData | null {
    if (!this.config.persistenceKey) return null;

    try {
      const stored = localStorage.getItem(this.config.persistenceKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to retrieve persisted data:', error);
      return null;
    }
  }

  public clearPersistedData(): void {
    if (this.config.persistenceKey) {
      localStorage.removeItem(this.config.persistenceKey);
    }
  }
}

// Utility function for React components
export function usePageLifecycle(config: LifecycleConfig) {
  const managerRef = React.useRef<PageLifecycleManager | null>(null);

  React.useEffect(() => {
    managerRef.current = new PageLifecycleManager(config);

    return () => {
      managerRef.current?.destroy();
    };
  }, []); // Empty deps - config is captured in closure

  return React.useMemo(() => ({
    flushData: async (url: string, data: BodyInit | Record<string, any>) => {
      return managerRef.current?.flushWithBeacon(url, data) || false;
    },
    isVisible: managerRef.current?.pageVisible ?? true,
    getPersistedData: () => managerRef.current?.getPersistedData() || null,
    clearPersistedData: () => managerRef.current?.clearPersistedData()
  }), []);
}

// Simple function-based API for non-React usage
export function setupPageLifecycle(config: LifecycleConfig): PageLifecycleManager {
  return new PageLifecycleManager(config);
}

// Utility function for immediate data flushing
export async function flushWithBeacon(url: string, body: BodyInit | Record<string, any>): Promise<boolean> {
  const manager = new PageLifecycleManager({});
  const result = await manager.flushWithBeacon(url, body);
  manager.destroy();
  return result;
}

export default PageLifecycleManager;