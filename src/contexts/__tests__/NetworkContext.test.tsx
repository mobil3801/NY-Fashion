
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { NetworkProvider, useNetwork, useOnlineStatus } from '../NetworkContext';
import { toast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/hooks/use-network-retry', () => ({
  useNetworkRetry: () => ({ retryWithBackoff: vi.fn() })
}));

vi.mock('@/utils/production-logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('@/utils/env-validator', () => ({
  isProduction: vi.fn(() => false)
}));

vi.mock('@/lib/network/connectivity', () => ({
  createConnectivity: vi.fn(() => ({
    checkConnection: vi.fn(() => Promise.resolve(true))
  }))
}));

vi.mock('@/lib/network/production-connectivity', () => ({
  createProductionConnectivity: vi.fn(() => ({
    checkConnection: vi.fn(() => Promise.resolve(true))
  }))
}));

vi.mock('@/lib/network/error-classifier', () => ({
  NetworkErrorClassifier: {
    classifyError: vi.fn(() => ({
      isNetworkError: true,
      isTimeoutError: false
    }))
  }
}));

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    downlink: 10,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
});

// Mock performance
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => 100)
  }
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

// Test component to access NetworkContext
const TestComponent = () => {
  const network = useNetwork();
  const isOnline = useOnlineStatus();

  return (
    <div>
      <div data-testid="is-online">{isOnline ? 'online' : 'offline'}</div>
      <div data-testid="is-connected">{network.isConnected ? 'connected' : 'disconnected'}</div>
      <div data-testid="network-status">{network.networkStatus}</div>
      <div data-testid="connection-quality">{network.connectionQuality}</div>
      <div data-testid="latency">{network.latency}</div>
      <div data-testid="pending-requests">{network.pendingRequests}</div>
      <div data-testid="failed-requests">{network.failedRequests}</div>
      <div data-testid="queued-operations">{network.queuedOperations}</div>
      <button
        data-testid="check-connection"
        onClick={() => network.checkConnection()}>

        Check Connection
      </button>
      <button
        data-testid="clear-errors"
        onClick={() => network.clearErrors()}>

        Clear Errors
      </button>
      <button
        data-testid="retry-requests"
        onClick={() => network.retryFailedRequests()}>

        Retry Requests
      </button>
    </div>);

};

describe('NetworkContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('NetworkProvider initialization', () => {
    it('should initialize with default values', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      expect(screen.getByTestId('is-online')).toHaveTextContent('online');
      expect(screen.getByTestId('network-status')).toHaveTextContent('connecting');
      expect(screen.getByTestId('connection-quality')).toHaveTextContent('unknown');
      expect(screen.getByTestId('latency')).toHaveTextContent('0');
      expect(screen.getByTestId('pending-requests')).toHaveTextContent('0');
      expect(screen.getByTestId('failed-requests')).toHaveTextContent('0');
      expect(screen.getByTestId('queued-operations')).toHaveTextContent('0');
    });

    it('should setup event listeners for online/offline events', () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should initialize connection quality from navigator.connection', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Wait for initialization effects to complete
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Connection quality should be determined from navigator.connection
      await waitFor(() => {
        expect(screen.getByTestId('connection-quality')).toHaveTextContent('excellent');
      });
    });
  });

  describe('Network status updates', () => {
    it('should handle online event', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Simulate offline first
      Object.defineProperty(navigator, 'onLine', { value: false });

      // Trigger offline event
      const offlineHandler = mockAddEventListener.mock.calls.find(
        (call) => call[0] === 'offline'
      )?.[1];

      if (offlineHandler) {
        act(() => {
          offlineHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('is-online')).toHaveTextContent('offline');
      });

      // Now go back online
      Object.defineProperty(navigator, 'onLine', { value: true });

      const onlineHandler = mockAddEventListener.mock.calls.find(
        (call) => call[0] === 'online'
      )?.[1];

      if (onlineHandler) {
        act(() => {
          onlineHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('is-online')).toHaveTextContent('online');
      });
    });

    it('should update connection metrics when connection changes', async () => {
      const mockConnection = {
        effectiveType: '3g',
        downlink: 2,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      Object.defineProperty(navigator, 'connection', {
        value: mockConnection
      });

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Simulate connection change
      const changeHandler = mockConnection.addEventListener.mock.calls.find(
        (call) => call[0] === 'change'
      )?.[1];

      if (changeHandler) {
        act(() => {
          changeHandler();
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('connection-quality')).toHaveTextContent('good');
      });
    });
  });

  describe('API monitoring', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should monitor successful API requests', async () => {
      const mockFetch = vi.fn(() => Promise.resolve(new Response('OK', { status: 200 })));
      global.fetch = mockFetch;

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Make a request
      await act(async () => {
        await fetch('/api/test');
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('connected');
        expect(screen.getByTestId('network-status')).toHaveTextContent('connected');
      });
    });

    it('should handle API request errors', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      global.fetch = mockFetch;

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Make a failing request
      await act(async () => {
        try {
          await fetch('/api/test');
        } catch (error) {


          // Expected to fail
        }});
      await waitFor(() => {
        expect(screen.getByTestId('failed-requests')).toHaveTextContent('1');
        expect(screen.getByTestId('is-connected')).toHaveTextContent('disconnected');
      });
    });

    it('should track pending requests correctly', async () => {
      let resolveRequest: () => void;
      const mockFetch = vi.fn(() =>
      new Promise((resolve) => {
        resolveRequest = () => resolve(new Response('OK', { status: 200 }));
      })
      );
      global.fetch = mockFetch;

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Start a request but don't resolve it yet
      act(() => {
        fetch('/api/test');
      });

      await waitFor(() => {
        expect(screen.getByTestId('pending-requests')).toHaveTextContent('1');
      });

      // Resolve the request
      act(() => {
        resolveRequest!();
      });

      await waitFor(() => {
        expect(screen.getByTestId('pending-requests')).toHaveTextContent('0');
      });
    });
  });

  describe('Connection checking', () => {
    it('should check connection when requested', async () => {
      const mockCheckConnection = vi.fn(() => Promise.resolve(true));
      const { createConnectivity } = await import('@/lib/network/connectivity');
      (createConnectivity as any).mockReturnValue({
        checkConnection: mockCheckConnection
      });

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      const checkButton = screen.getByTestId('check-connection');

      await act(async () => {
        checkButton.click();
      });

      await waitFor(() => {
        expect(mockCheckConnection).toHaveBeenCalled();
      });
    });

    it('should handle connection check failures', async () => {
      const mockCheckConnection = vi.fn(() => Promise.reject(new Error('Check failed')));
      const { createConnectivity } = await import('@/lib/network/connectivity');
      (createConnectivity as any).mockReturnValue({
        checkConnection: mockCheckConnection
      });

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      const checkButton = screen.getByTestId('check-connection');

      await act(async () => {
        checkButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('disconnected');
        expect(screen.getByTestId('network-status')).toHaveTextContent('error');
      });
    });

    it('should perform periodic connection checks', async () => {
      const mockCheckConnection = vi.fn(() => Promise.resolve(true));
      const { createConnectivity } = await import('@/lib/network/connectivity');
      (createConnectivity as any).mockReturnValue({
        checkConnection: mockCheckConnection
      });

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Fast forward 30 seconds to trigger periodic check
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(mockCheckConnection).toHaveBeenCalledTimes(2); // Initial + periodic
      });
    });
  });

  describe('Error handling', () => {
    it('should clear errors when requested', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // First simulate an error by making a failing request
      const mockFetch = vi.fn(() => Promise.reject(new Error('Test error')));
      global.fetch = mockFetch;

      await act(async () => {
        try {
          await fetch('/api/test');
        } catch (error) {


          // Expected
        }});
      await waitFor(() => {
        expect(screen.getByTestId('failed-requests')).toHaveTextContent('1');
      });

      // Clear errors
      const clearButton = screen.getByTestId('clear-errors');
      await act(async () => {
        clearButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('failed-requests')).toHaveTextContent('0');
      });
    });

    it('should handle multiple connection errors gracefully', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      global.fetch = mockFetch;

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Simulate multiple errors
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          try {
            await fetch('/api/test');
          } catch (error) {


            // Expected
          }});}

      await waitFor(() => {
        expect(screen.getByTestId('failed-requests')).toHaveTextContent('4');
      });

      // Should have shown toast notification after 3 errors
      expect(vi.mocked(toast)).toHaveBeenCalled();
    });
  });

  describe('Queue management', () => {
    it('should handle queue operations safely in production mode', async () => {
      const { isProduction } = await import('@/utils/env-validator');
      (isProduction as any).mockReturnValue(true);

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Wait for queue size update
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('queued-operations')).toHaveTextContent('0');
      });
    });

    it('should retry failed requests when connected', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      // Ensure we're connected
      await act(async () => {
        const checkButton = screen.getByTestId('check-connection');
        checkButton.click();
      });

      // Retry requests
      const retryButton = screen.getByTestId('retry-requests');
      await act(async () => {
        retryButton.click();
      });

      // Should complete without errors
      expect(screen.getByTestId('is-connected')).toHaveTextContent('connected');
    });
  });

  describe('Diagnostics', () => {
    it('should generate comprehensive connection diagnostics', async () => {
      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      const network = useNetwork();

      await act(async () => {
        const diagnostics = await network.getConnectionDiagnostics();

        expect(diagnostics).toHaveProperty('isOnline');
        expect(diagnostics).toHaveProperty('isConnected');
        expect(diagnostics).toHaveProperty('networkStatus');
        expect(diagnostics).toHaveProperty('connectionQuality');
        expect(diagnostics).toHaveProperty('latency');
        expect(diagnostics).toHaveProperty('bandwidth');
        expect(diagnostics).toHaveProperty('signalStrength');
        expect(diagnostics).toHaveProperty('pendingRequests');
        expect(diagnostics).toHaveProperty('failedRequests');
        expect(diagnostics).toHaveProperty('queuedOperations');
        expect(diagnostics).toHaveProperty('timestamp');
        expect(diagnostics).toHaveProperty('uptime');
      });
    });
  });

  describe('Memory management', () => {
    it('should clean up event listeners on unmount', () => {
      const { unmount } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clean up timers on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('useNetwork hook', () => {
    it('should throw error when used outside provider', () => {
      const TestComponentOutside = () => {
        useNetwork();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponentOutside />);
      }).toThrow('useNetwork must be used within a NetworkProvider');
    });
  });

  describe('Production mode behavior', () => {
    it('should use production connectivity in production mode', async () => {
      const { isProduction } = await import('@/utils/env-validator');
      const { createProductionConnectivity } = await import('@/lib/network/production-connectivity');

      (isProduction as any).mockReturnValue(true);

      render(
        <NetworkProvider>
          <TestComponent />
        </NetworkProvider>
      );

      expect(createProductionConnectivity).toHaveBeenCalled();
    });
  });
});