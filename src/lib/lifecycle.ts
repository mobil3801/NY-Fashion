
/**
 * Modern page lifecycle management
 * Replaces deprecated unload listeners with pagehide/visibilitychange
 */

export function onPageHide(cb: (ev: PageTransitionEvent) => void) {
  const handler = (e: any) => cb(e);
  addEventListener('pagehide', handler, { capture: true });
  return () => removeEventListener('pagehide', handler, { capture: true } as any);
}

export function onVisibilityHidden(cb: () => void) {
  const handler = () => {
    if (document.visibilityState === 'hidden') cb();
  };
  document.addEventListener('visibilitychange', handler, { capture: true });
  return () => document.removeEventListener('visibilitychange', handler, { capture: true } as any);
}

export async function flushWithBeacon(url: string, body: any) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  
  if (navigator.sendBeacon && typeof payload === 'string') {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }
  
  // Fallback to fetch with keepalive
  await fetch(url, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  });
}

// React hook for modern lifecycle management
export function usePageLifecycle() {
  const flushData = (data: any) => {
    if (import.meta.env.DEV) {
      console.log('[Lifecycle] Flushing data on page hide:', data);
    }
  };

  React.useEffect(() => {
    const cleanup1 = onPageHide((e) => {
      flushData({ event: 'pagehide', persisted: e.persisted });
    });

    const cleanup2 = onVisibilityHidden(() => {
      flushData({ event: 'visibilitychange', hidden: true });
    });

    return () => {
      cleanup1();
      cleanup2();
    };
  }, []);
}

// Page lifecycle manager class
export class PageLifecycleManager {
  private cleanupFunctions: (() => void)[] = [];
  
  constructor() {
    this.setupListeners();
    this.preventUnloadInDev();
  }

  private setupListeners() {
    const cleanup1 = onPageHide((e) => {
      this.handlePageHide(e);
    });

    const cleanup2 = onVisibilityHidden(() => {
      this.handleVisibilityHidden();
    });

    this.cleanupFunctions.push(cleanup1, cleanup2);
  }

  private handlePageHide(e: PageTransitionEvent) {
    if (import.meta.env.DEV) {
      console.log('[PageLifecycle] Page hide event:', e.persisted);
    }
    // Handle page hide logic here
  }

  private handleVisibilityHidden() {
    if (import.meta.env.DEV) {
      console.log('[PageLifecycle] Page visibility hidden');
    }
    // Handle visibility hidden logic here
  }

  private preventUnloadInDev() {
    if (import.meta.env.DEV) {
      const orig = window.addEventListener;
      window.addEventListener = function(type: any, ...rest: any[]) {
        if (type === 'unload') {
          throw new Error('Do not use unload in main frame - use pagehide/visibilitychange instead');
        }
        // @ts-ignore
        return orig.call(this, type, ...rest);
      };
    }
  }

  public cleanup() {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
  }
}

// Setup page lifecycle on app initialization
export function setupPageLifecycle() {
  return new PageLifecycleManager();
}
