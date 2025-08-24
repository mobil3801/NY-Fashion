
export class InventoryServiceWorker {
  private static instance: InventoryServiceWorker;
  private serviceWorker: ServiceWorker | null = null;
  private isSupported = false;

  constructor() {
    this.isSupported = 'serviceWorker' in navigator;
  }

  static getInstance(): InventoryServiceWorker {
    if (!this.instance) {
      this.instance = new InventoryServiceWorker();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (!this.isSupported) {
      console.warn('[InventorySW] Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/inventory-sw.js', {
        scope: '/'
      });

      console.log('[InventorySW] Service Worker registered:', registration);

      // Wait for the service worker to be ready
      if (registration.installing) {
        await new Promise<void>((resolve) => {
          registration.installing!.addEventListener('statechange', () => {
            if (registration.installing!.state === 'activated') {
              resolve();
            }
          });
        });
      }

      this.serviceWorker = registration.active;

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker installed, notify user of update
              this.notifyUpdate();
            }
          });
        }
      });

    } catch (error) {
      console.error('[InventorySW] Service Worker registration failed:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, count } = event.data;

    switch (type) {
      case 'CACHE_BUMPED':
        console.log(`[InventorySW] Cache bumped - ${count} entries refreshed`);
        // Optionally notify the UI
        window.dispatchEvent(new CustomEvent('inventory-cache-bumped', { 
          detail: { count } 
        }));
        break;
        
      case 'CACHE_CLEARED':
        console.log('[InventorySW] All caches cleared');
        window.dispatchEvent(new CustomEvent('inventory-cache-cleared'));
        break;
    }
  }

  private notifyUpdate(): void {
    // Notify the user that a new version is available
    window.dispatchEvent(new CustomEvent('inventory-sw-update-available'));
  }

  async bumpCache(): Promise<void> {
    if (!this.isSupported || !this.serviceWorker) {
      console.warn('[InventorySW] Service Worker not available for cache bump');
      return;
    }

    try {
      this.serviceWorker.postMessage({ type: 'CACHE_BUMP' });
      console.log('[InventorySW] Cache bump requested');
    } catch (error) {
      console.error('[InventorySW] Cache bump failed:', error);
    }
  }

  async clearCache(): Promise<void> {
    if (!this.isSupported || !this.serviceWorker) {
      console.warn('[InventorySW] Service Worker not available for cache clear');
      return;
    }

    try {
      this.serviceWorker.postMessage({ type: 'CLEAR_CACHE' });
      console.log('[InventorySW] Cache clear requested');
    } catch (error) {
      console.error('[InventorySW] Cache clear failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.isSupported) return;

    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  isServiceWorkerSupported(): boolean {
    return this.isSupported;
  }
}

// Global instance
export const inventoryServiceWorker = InventoryServiceWorker.getInstance();
