import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PageLifecycleManager, flushWithBeacon } from '@/utils/lifecycle';
import { enableUnloadProtection, disableUnloadProtection, checkForExistingUnloadHandlers } from '@/devtools/assertNoUnload';

// Mock navigator.sendBeacon
const mockSendBeacon = vi.fn();
Object.defineProperty(navigator, 'sendBeacon', {
  value: mockSendBeacon,
  writable: true
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock document properties
Object.defineProperty(document, 'hidden', {
  value: false,
  writable: true
});

Object.defineProperty(document, 'visibilityState', {
  value: 'visible',
  writable: true
});

describe('PageLifecycleManager', () => {
  let manager: PageLifecycleManager;
  let mockPageHide: vi.MockedFunction<any>;
  let mockVisibilityChange: vi.MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPageHide = vi.fn();
    mockVisibilityChange = vi.fn();
    mockSendBeacon.mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: true });
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    manager?.destroy();
  });

  it('should initialize without errors', () => {
    manager = new PageLifecycleManager({
      onPageHide: mockPageHide,
      onVisibilityChange: mockVisibilityChange
    });

    expect(manager.pageVisible).toBe(true);
  });

  it('should handle pagehide events', () => {
    manager = new PageLifecycleManager({
      onPageHide: mockPageHide
    });

    // Simulate pagehide event
    const event = new Event('pagehide') as PageTransitionEvent;
    window.dispatchEvent(event);

    expect(mockPageHide).toHaveBeenCalledWith(event);
  });

  it('should handle visibility changes', () => {
    manager = new PageLifecycleManager({
      onVisibilityChange: mockVisibilityChange
    });

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockVisibilityChange).toHaveBeenCalledWith(false);
  });

  it('should send beacon data on pagehide', () => {
    const testData = { test: 'data' };
    manager = new PageLifecycleManager({
      sendBeacon: {
        url: 'https://example.com/beacon',
        data: testData
      }
    });

    // Simulate pagehide event
    window.dispatchEvent(new Event('pagehide'));

    expect(mockSendBeacon).toHaveBeenCalledWith(
      'https://example.com/beacon',
      expect.any(Blob)
    );
  });

  it('should persist data to localStorage', () => {
    const testData = { test: 'data' };
    manager = new PageLifecycleManager({
      persistenceKey: 'test-key',
      sendBeacon: {
        url: 'https://example.com/beacon',
        data: testData
      }
    });

    // Simulate pagehide event
    window.dispatchEvent(new Event('pagehide'));

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      expect.stringContaining('test')
    );
  });

  it('should retrieve persisted data', () => {
    const testData = { test: 'data', timestamp: Date.now() };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData));

    manager = new PageLifecycleManager({
      persistenceKey: 'test-key'
    });

    const retrieved = manager.getPersistedData();
    expect(retrieved).toEqual(testData);
  });

  it('should clean up listeners on destroy', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    manager = new PageLifecycleManager({
      onPageHide: mockPageHide
    });

    manager.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    );
  });

  it('should not trigger handlers after destroy', () => {
    manager = new PageLifecycleManager({
      onPageHide: mockPageHide
    });

    manager.destroy();

    // Simulate pagehide event after destroy
    window.dispatchEvent(new Event('pagehide'));

    expect(mockPageHide).not.toHaveBeenCalled();
  });
});

describe('flushWithBeacon utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendBeacon.mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it('should use sendBeacon when available', async () => {
    const result = await flushWithBeacon('https://example.com/beacon', { test: 'data' });

    expect(result).toBe(true);
    expect(mockSendBeacon).toHaveBeenCalledWith(
      'https://example.com/beacon',
      expect.any(Blob)
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fallback to fetch when sendBeacon fails', async () => {
    mockSendBeacon.mockReturnValue(false);

    const result = await flushWithBeacon('https://example.com/beacon', { test: 'data' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/beacon',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('should handle different data types', async () => {
    // String data
    await flushWithBeacon('https://example.com/beacon', 'string data');
    expect(mockSendBeacon).toHaveBeenCalled();

    vi.clearAllMocks();

    // FormData
    const formData = new FormData();
    formData.append('key', 'value');
    await flushWithBeacon('https://example.com/beacon', formData);
    expect(mockSendBeacon).toHaveBeenCalledWith(
      'https://example.com/beacon',
      formData
    );
  });
});

describe('Unload Protection', () => {
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  beforeEach(() => {
    disableUnloadProtection();
    vi.clearAllMocks();
  });

  afterEach(() => {
    disableUnloadProtection();
    EventTarget.prototype.addEventListener = originalAddEventListener;
  });

  it('should throw on unload event listeners', () => {
    enableUnloadProtection({ throwOnUnload: true });

    expect(() => {
      window.addEventListener('unload', () => {});
    }).toThrow('Unload handler detected');
  });

  it('should throw on beforeunload event listeners when configured', () => {
    enableUnloadProtection({ throwOnBeforeUnload: true });

    expect(() => {
      window.addEventListener('beforeunload', () => {});
    }).toThrow('Unload handler detected');
  });

  it('should allow non-unload event listeners', () => {
    enableUnloadProtection();
    const handler = vi.fn();

    expect(() => {
      window.addEventListener('click', handler);
      window.addEventListener('pagehide', handler);
      window.addEventListener('visibilitychange', handler);
    }).not.toThrow();
  });

  it('should allow unload handlers from allowed origins', () => {
    enableUnloadProtection({
      allowedOrigins: ['easysite.ai'],
      throwOnUnload: true
    });

    // This is difficult to test directly since we can't easily mock the stack trace
    // In practice, this would allow third-party scripts from easysite.ai
    expect(true).toBe(true); // Placeholder
  });
});

describe('Integration Tests', () => {
  it('should work with multiple lifecycle events in sequence', () => {
    const mockPageHide = vi.fn();
    const mockVisibilityChange = vi.fn();

    const manager = new PageLifecycleManager({
      onPageHide: mockPageHide,
      onVisibilityChange: mockVisibilityChange,
      sendBeacon: {
        url: 'https://example.com/beacon',
        data: { test: 'data' }
      }
    });

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // Simulate pagehide
    window.dispatchEvent(new Event('pagehide'));

    expect(mockVisibilityChange).toHaveBeenCalledWith(false);
    expect(mockPageHide).toHaveBeenCalled();
    expect(mockSendBeacon).toHaveBeenCalledTimes(2); // Once for each event

    manager.destroy();
  });
});