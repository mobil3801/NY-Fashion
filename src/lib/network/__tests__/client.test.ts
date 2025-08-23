
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, createApiError } from '../client';
import { ApiError } from '@/lib/errors';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
  let client: ApiClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient({ baseURL: 'http://localhost:3000' });
  });

  afterEach(() => {
    client.destroy();
  });

  describe('GET requests', () => {
    it('should handle successful requests', async () => {
      const mockData = { id: 1, name: 'test' };
      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await client.get('/api/test');
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'));
      
      await expect(client.get('/api/test')).rejects.toThrow(ApiError);
    });
  });

  describe('POST requests when online', () => {
    beforeEach(() => {
      client.setOnlineStatus(true);
    });

    it('should handle successful POST requests', async () => {
      const mockData = { id: 1 };
      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockData), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await client.post('/api/test', { name: 'test' });
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
    });
  });

  describe('POST requests when offline', () => {
    beforeEach(() => {
      client.setOnlineStatus(false);
    });

    it('should queue write operations when offline', async () => {
      await expect(client.post('/api/test', { name: 'test' }))
        .rejects.toThrow('Saved offline');
      
      const queueStatus = client.getQueueStatus();
      expect(queueStatus.size).toBe(1);
      expect(queueStatus.operations[0].type).toBe('POST');
    });

    it('should not queue when skipOfflineQueue is true', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'));
      
      await expect(
        client.post('/api/test', { name: 'test' }, { skipOfflineQueue: true })
      ).rejects.toThrow(ApiError);
      
      expect(client.getQueueStatus().size).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValue(new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));

      const result = await client.get('/api/test');
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

      await expect(client.get('/api/test')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 4xx
    });
  });

  describe('offline queue flushing', () => {
    it('should flush queue when going online', async () => {
      // Start offline and queue an operation
      client.setOnlineStatus(false);
      await expect(client.post('/api/test', { name: 'test' }))
        .rejects.toThrow('Saved offline');

      // Mock successful flush
      mockFetch.mockResolvedValue(new Response('{}', { status: 201 }));
      
      // Go online - should trigger flush
      client.setOnlineStatus(true);
      
      // Give some time for async flush
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('queue management', () => {
    beforeEach(() => {
      client.setOnlineStatus(false);
    });

    it('should provide queue status', async () => {
      await expect(client.post('/api/test1', { name: 'test1' }))
        .rejects.toThrow('Saved offline');
      await expect(client.post('/api/test2', { name: 'test2' }))
        .rejects.toThrow('Saved offline');

      const status = client.getQueueStatus();
      expect(status.size).toBe(2);
      expect(status.isEmpty).toBe(false);
      expect(status.operations).toHaveLength(2);
    });

    it('should clear queue', async () => {
      await expect(client.post('/api/test', { name: 'test' }))
        .rejects.toThrow('Saved offline');
      
      await client.clearQueue();
      
      const status = client.getQueueStatus();
      expect(status.isEmpty).toBe(true);
    });
  });
});

describe('createApiError', () => {
  it('should create ApiError with correct properties', () => {
    const error = createApiError('Test error', 'TEST_CODE', true, { detail: 'test' });
    
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ detail: 'test' });
  });
});
