
import { apiClient } from './client';
import { NetworkContext } from '@/contexts/NetworkContext';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/errors';
import { useContext } from 'react';

interface ApiWrapperOptions {
  showErrorToast?: boolean;
  skipOfflineQueue?: boolean;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  maxRetries?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

class NetworkAPIWrapper {
  private defaultOptions: ApiWrapperOptions = {
    showErrorToast: true,
    skipOfflineQueue: false,
    priority: 'medium',
    timeout: 10000,
    maxRetries: 3
  };

  // Enhanced GET with better error handling
  async get<T = any>(
    url: string, 
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const data = await apiClient.get<T>(url, {
        timeout: opts.timeout,
        retry: { attempts: opts.maxRetries }
      });
      
      opts.onSuccess?.(data);
      return { data, error: null };
      
    } catch (error) {
      const apiError = error as ApiError;
      const errorMessage = this.getErrorMessage(apiError);
      
      if (opts.showErrorToast) {
        this.showErrorToast(apiError);
      }
      
      opts.onError?.(apiError);
      
      return { 
        data: null, 
        error: errorMessage,
        wasQueued: apiError.code === 'QUEUED_OFFLINE'
      };
    }
  }

  // Enhanced POST with offline queue support
  async post<T = any>(
    url: string, 
    data?: any, 
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const result = await apiClient.post<T>(url, data, {
        timeout: opts.timeout,
        skipOfflineQueue: opts.skipOfflineQueue,
        retry: { attempts: opts.maxRetries }
      });
      
      opts.onSuccess?.(result);
      return { data: result, error: null };
      
    } catch (error) {
      const apiError = error as ApiError;
      
      // Handle offline queueing gracefully
      if (apiError.code === 'QUEUED_OFFLINE') {
        if (opts.showErrorToast) {
          this.showQueuedToast();
        }
        return { 
          data: null, 
          error: null, 
          wasQueued: true 
        };
      }
      
      const errorMessage = this.getErrorMessage(apiError);
      
      if (opts.showErrorToast) {
        this.showErrorToast(apiError);
      }
      
      opts.onError?.(apiError);
      
      return { 
        data: null, 
        error: errorMessage 
      };
    }
  }

  // Enhanced PUT with offline queue support
  async put<T = any>(
    url: string, 
    data?: any, 
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const result = await apiClient.put<T>(url, data, {
        timeout: opts.timeout,
        skipOfflineQueue: opts.skipOfflineQueue,
        retry: { attempts: opts.maxRetries }
      });
      
      opts.onSuccess?.(result);
      return { data: result, error: null };
      
    } catch (error) {
      const apiError = error as ApiError;
      
      if (apiError.code === 'QUEUED_OFFLINE') {
        if (opts.showErrorToast) {
          this.showQueuedToast();
        }
        return { 
          data: null, 
          error: null, 
          wasQueued: true 
        };
      }
      
      const errorMessage = this.getErrorMessage(apiError);
      
      if (opts.showErrorToast) {
        this.showErrorToast(apiError);
      }
      
      opts.onError?.(apiError);
      
      return { 
        data: null, 
        error: errorMessage 
      };
    }
  }

  // Enhanced DELETE with offline queue support
  async delete<T = any>(
    url: string, 
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const result = await apiClient.delete<T>(url, {
        timeout: opts.timeout,
        skipOfflineQueue: opts.skipOfflineQueue,
        retry: { attempts: opts.maxRetries }
      });
      
      opts.onSuccess?.(result);
      return { data: result, error: null };
      
    } catch (error) {
      const apiError = error as ApiError;
      
      if (apiError.code === 'QUEUED_OFFLINE') {
        if (opts.showErrorToast) {
          this.showQueuedToast();
        }
        return { 
          data: null, 
          error: null, 
          wasQueued: true 
        };
      }
      
      const errorMessage = this.getErrorMessage(apiError);
      
      if (opts.showErrorToast) {
        this.showErrorToast(apiError);
      }
      
      opts.onError?.(apiError);
      
      return { 
        data: null, 
        error: errorMessage 
      };
    }
  }

  // EasySite API integration methods
  async ezGet<T = any>(
    path: string,
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const response = await window.ezsite.apis.get(path);
      if (response.error) {
        throw new Error(response.error);
      }
      return { data: response.data, error: null };
    } catch (error) {
      if (options.showErrorToast !== false) {
        this.showErrorToast(error as Error);
      }
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async ezTablePage<T = any>(
    tableId: string,
    queryParams: any,
    options: ApiWrapperOptions = {}
  ): Promise<{ data: { List: T[]; VirtualCount: number } | null; error: string | null }> {
    try {
      const response = await window.ezsite.apis.tablePage(tableId, queryParams);
      if (response.error) {
        throw new Error(response.error);
      }
      return { data: response.data, error: null };
    } catch (error) {
      if (options.showErrorToast !== false) {
        this.showErrorToast(error as Error);
      }
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async ezTableCreate<T = any>(
    tableId: string,
    data: any,
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    // Check if offline and queue the operation
    if (!navigator.onLine && !options.skipOfflineQueue) {
      try {
        await this.queueEzOperation('CREATE', tableId, data);
        if (options.showErrorToast !== false) {
          this.showQueuedToast();
        }
        return { data: null, error: null, wasQueued: true };
      } catch (queueError) {
        return { data: null, error: 'Failed to queue operation' };
      }
    }

    try {
      const response = await window.ezsite.apis.tableCreate(tableId, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return { data: response.data, error: null };
    } catch (error) {
      if (options.showErrorToast !== false) {
        this.showErrorToast(error as Error);
      }
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async ezTableUpdate<T = any>(
    tableId: string,
    data: any,
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    if (!navigator.onLine && !options.skipOfflineQueue) {
      try {
        await this.queueEzOperation('UPDATE', tableId, data);
        if (options.showErrorToast !== false) {
          this.showQueuedToast();
        }
        return { data: null, error: null, wasQueued: true };
      } catch (queueError) {
        return { data: null, error: 'Failed to queue operation' };
      }
    }

    try {
      const response = await window.ezsite.apis.tableUpdate(tableId, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return { data: response.data, error: null };
    } catch (error) {
      if (options.showErrorToast !== false) {
        this.showErrorToast(error as Error);
      }
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async ezTableDelete<T = any>(
    tableId: string,
    deleteParams: any,
    options: ApiWrapperOptions = {}
  ): Promise<{ data: T | null; error: string | null; wasQueued?: boolean }> {
    if (!navigator.onLine && !options.skipOfflineQueue) {
      try {
        await this.queueEzOperation('DELETE', tableId, deleteParams);
        if (options.showErrorToast !== false) {
          this.showQueuedToast();
        }
        return { data: null, error: null, wasQueued: true };
      } catch (queueError) {
        return { data: null, error: 'Failed to queue operation' };
      }
    }

    try {
      const response = await window.ezsite.apis.tableDelete(tableId, deleteParams);
      if (response.error) {
        throw new Error(response.error);
      }
      return { data: response.data, error: null };
    } catch (error) {
      if (options.showErrorToast !== false) {
        this.showErrorToast(error as Error);
      }
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async queueEzOperation(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    tableId: string,
    data: any
  ): Promise<void> {
    // Store EasySite operations in a special format for later processing
    const queueData = {
      type: 'EZSITE_OPERATION',
      operation,
      tableId,
      data,
      timestamp: Date.now()
    };
    
    await apiClient.getOfflineQueue().enqueue(
      'POST',
      `/ezsite/${operation.toLowerCase()}/${tableId}`,
      queueData
    );
  }

  private getErrorMessage(error: ApiError | Error): string {
    if (error instanceof ApiError) {
      return error.message;
    }
    return error.message || 'An unexpected error occurred';
  }

  private showErrorToast(error: ApiError | Error): void {
    // Dynamic import to avoid circular dependencies
    import('@/hooks/use-toast').then(({ toast }) => {
      let title = "Connection Error";
      let description = "Please check your connection and try again.";
      
      if (error instanceof ApiError) {
        switch (error.code) {
          case 'NETWORK_OFFLINE':
            title = "You're Offline";
            description = "Check your internet connection.";
            break;
          case 'TIMEOUT':
            title = "Request Timed Out";
            description = "The server took too long to respond.";
            break;
          case 'SERVER_ERROR':
            title = "Server Error";
            description = "The server is experiencing issues.";
            break;
          default:
            description = error.message;
        }
      } else {
        description = error.message;
      }

      toast({
        title,
        description,
        variant: "destructive"
      });
    });
  }

  private showQueuedToast(): void {
    import('@/hooks/use-toast').then(({ toast }) => {
      toast({
        title: "Saved Offline",
        description: "Your changes will sync when you're back online.",
        variant: "default"
      });
    });
  }
}

// Export singleton instance
export const networkAPI = new NetworkAPIWrapper();

// Export for backward compatibility
export { networkAPI as default };
