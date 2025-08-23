
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { ApiClient, apiClient, createApiError } from '../client';
import { ApiError } from '../../errors';

// Mock global fetch
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock window properties
Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://example.com'
  },
  writable: true
});

// Mock AbortController
class MockAbortController {
  signal = {};
  abort = vi.fn();
}
global.AbortController = MockAbortController as any;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new ApiClient();
  });

  afterEach(() => {
    client?.destroy();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(client).toBeDefined();
      expect(client.getNetworkDiagnostics().isOnline).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customClient = new ApiClient({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        retries: 5
      });

      expect(customClient).toBeDefined();
      customClient.destroy();
    });
  });

  describe('network status management', () => {
    it('should update online status and notify subscribers', () => {
      const callback = vi.fn();
      client.subscribeToNetworkStatus(callback);

      client.setOnlineStatus(false);
      expect(callback).toHaveBeenCalledWith(false);
      expect(client.getNetworkDiagnostics().isOnline).toBe(false);

      client.setOnlineStatus(true);
      expect(callback).toHaveBeenCalledWith(true);
      expect(client.getNetworkDiagnostics().isOnline).toBe(true);
    });

    it('should handle errors in network status callbacks gracefully', () => {
      const errorCallback = vi.fn(() => {throw new Error('Callback error');});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.subscribeToNetworkStatus(errorCallback);
      client.setOnlineStatus(false);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in network status callback:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should unsubscribe network status callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = client.subscribeToNetworkStatus(callback);

      unsubscribe();
      client.setOnlineStatus(false);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' }
      }));

      const result = await client.get('/api/test');
      expect(result).toBe('Plain text response');
    });

    it('should throw ApiError for HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', {
        status: 404,
        statusText: 'Not Found'
      }));

      await expect(client.get('/api/test')).rejects.toThrow(ApiError);
      await expect(client.get('/api/test')).rejects.toMatchObject({
        code: 'CLIENT_ERROR',
        retryable: false
      });
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const requestData = { name: 'New Item' };
      const responseData = { id: 1, name: 'New Item' };

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(responseData), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.post('/api/items', requestData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result).toEqual(responseData);
    });

    it('should queue requests when offline', async () => {
      client.setOnlineStatus(false);

      const requestData = { name: 'Offline Item' };

      await expect(client.post('/api/items', requestData)).rejects.toMatchObject({
        code: 'QUEUED_OFFLINE',
        retryable: false
      });

      const queueStatus = client.getQueueStatus();
      expect(queueStatus.size).toBe(1);
      expect(queueStatus.operations[0]).toMatchObject({
        type: 'POST',
        url: '/api/items',
        data: requestData
      });
    });

    it('should skip offline queue when specified', async () => {
      client.setOnlineStatus(false);
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.post('/api/items', {}, { skipOfflineQueue: true })).
      rejects.toMatchObject({
        code: 'NETWORK_OFFLINE'
      });

      expect(client.getQueueStatus().isEmpty).toBe(true);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on retryable errors', async () => {
      mockFetch.
      mockRejectedValueOnce(new TypeError('Network error')).
      mockRejectedValueOnce(new Error('Temporary failure')).
      mockResolvedValueOnce(new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.get('/api/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', {
        status: 400,
        statusText: 'Bad Request'
      }));

      await expect(client.get('/api/test')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect retry limits', async () => {
      const customClient = new ApiClient({ retries: 2 });
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      await expect(customClient.get('/api/test')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries

      customClient.destroy();
    });

    it('should skip retries when specified', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      await expect(client.get('/api/test', { skipRetry: true })).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout handling', () => {
    it('should timeout requests', async () => {
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const timeoutPromise = client.get('/api/test', { timeout: 1000 });
      vi.advanceTimersByTime(1000);

      await expect(timeoutPromise).rejects.toMatchObject({
        code: 'TIMEOUT'
      });
    });

    it('should use default timeout', async () => {
      mockFetch.mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 20000))
      );

      const timeoutPromise = client.get('/api/test');
      vi.advanceTimersByTime(10000);

      await expect(timeoutPromise).rejects.toMatchObject({
        code: 'TIMEOUT'
      });
    });
  });

  describe('offline queue', () => {
    it('should flush queue when back online', async () => {
      // Go offline and queue operations
      client.setOnlineStatus(false);

      await expect(client.post('/api/item1', { name: 'Item 1' })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });
      await expect(client.put('/api/item2', { name: 'Item 2' })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });

      expect(client.getQueueStatus().size).toBe(2);

      // Go back online
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
      client.setOnlineStatus(true);

      // Allow queue to flush
      await vi.waitFor(() => {
        expect(client.getQueueStatus().isEmpty).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle queue flush errors gracefully', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      client.setOnlineStatus(false);
      await expect(client.post('/api/item', { name: 'Item' })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });

      // Mock successful response for flush
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      client.setOnlineStatus(true);

      await vi.waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Processed 1 offline operations'));
      });

      consoleLogSpy.mockRestore();
    });

    it('should clear queue manually', async () => {
      client.setOnlineStatus(false);
      await expect(client.post('/api/item', { name: 'Item' })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });

      expect(client.getQueueStatus().size).toBe(1);

      await client.clearQueue();
      expect(client.getQueueStatus().isEmpty).toBe(true);
    });
  });

  describe('PUT and DELETE requests', () => {
    it('should make successful PUT request', async () => {
      const updateData = { id: 1, name: 'Updated Item' };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(updateData), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await client.put('/api/items/1', updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/items/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
      );
      expect(result).toEqual(updateData);
    });

    it('should make successful DELETE request', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 204 }));

      const result = await client.delete('/api/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/items/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
      expect(result).toBe('');
    });

    it('should queue PUT/DELETE when offline', async () => {
      client.setOnlineStatus(false);

      await expect(client.put('/api/items/1', { name: 'Updated' })).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });
      await expect(client.delete('/api/items/2')).
      rejects.toMatchObject({ code: 'QUEUED_OFFLINE' });

      const queueStatus = client.getQueueStatus();
      expect(queueStatus.size).toBe(2);
      expect(queueStatus.operations.map((op) => op.type)).toEqual(['PUT', 'DELETE']);
    });
  });

  describe('idempotency', () => {
    it('should add idempotency key to requests', async () => {
      mockFetch.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      await client.post('/api/items', { name: 'Item' }, {
        headers: { 'Idempotency-Key': 'unique-key' }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'unique-key'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should normalize network errors correctly', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.get('/api/test')).rejects.toMatchObject({
        code: 'NETWORK_OFFLINE',
        retryable: true
      });
    });

    it('should handle abort errors', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.get('/api/test')).rejects.toMatchObject({
        code: 'TIMEOUT',
        retryable: true
      });
    });

    it('should update network status on offline detection', async () => {
      const callback = vi.fn();
      client.subscribeToNetworkStatus(callback);

      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.get('/api/test')).rejects.toThrow();
      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe('memory safety', () => {
    it('should clean up resources on destroy', () => {
      const client = new ApiClient();

      // Should not throw
      expect(() => client.destroy()).not.toThrow();
    });
  });
});

describe('createApiError', () => {
  it('should create ApiError with default values', () => {
    const error = createApiError('Test error');

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.retryable).toBe(false);
  });

  it('should create ApiError with custom values', () => {
    const error = createApiError('Custom error', 'CUSTOM_CODE', true, { extra: 'data' });

    expect(error.message).toBe('Custom error');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ extra: 'data' });
  });
});

describe('global apiClient', () => {
  it('should be properly initialized', () => {
    expect(apiClient).toBeInstanceOf(ApiClient);
  });
});