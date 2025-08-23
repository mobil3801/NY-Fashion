
import { vi } from 'vitest';

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000'
  },
  writable: true
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn()
};

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Mock AbortController if not available
if (!global.AbortController) {
  global.AbortController = class {
    signal = { aborted: false };
    abort() {
      this.signal.aborted = true;
    }
  } as any;
}