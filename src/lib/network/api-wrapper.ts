
import { apiClient } from './client';
import { useNetwork } from '@/contexts/NetworkContext';
import { toast } from '@/hooks/use-toast';
import { ERROR_CODES, getUserFriendlyMessage, ApiError, normalizeError } from '@/lib/errors';

interface NetworkAwareAPIOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  skipOfflineQueue?: boolean;
  requireOnline?: boolean;
  operation?: string;
  retryable?: boolean;
}

export class NetworkAwareAPI {
  private static instance: NetworkAwareAPI;

  static getInstance(): NetworkAwareAPI {
    if (!NetworkAwareAPI.instance) {
      NetworkAwareAPI.instance = new NetworkAwareAPI();
    }
    return NetworkAwareAPI.instance;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: NetworkAwareAPIOptions = {}
  ): Promise<T> {
    const {
      showSuccessToast = false,
      showErrorToast = true,
      successMessage,
      skipOfflineQueue = false,
      requireOnline = false,
      operation: operationName = 'API call',
      retryable = true
    } = options;

    try {
      // Check if operation requires online connection
      if (requireOnline && !navigator.onLine) {
        throw new ApiError(
          'This operation requires an active internet connection',
          ERROR_CODES.NETWORK_OFFLINE,
          true,
          { operation: operationName }
        );
      }

      const result = await operation();

      // Show success toast if requested
      if (showSuccessToast && successMessage) {
        toast({
          title: "Success",
          description: successMessage,
          variant: "default"
        });
      }

      return result;
    } catch (error) {
      // Normalize the error with operation context
      const normalizedError = this.normalizeError(error, operationName);

      // Show error toast with appropriate handling
      if (showErrorToast) {
        this.handleErrorToast(normalizedError, retryable);
      }

      throw normalizedError;
    }
  }

  private normalizeError(error: unknown, operation: string): ApiError {
    // Use the enhanced error normalization from errors.ts
    const normalizedError = normalizeError(error, operation);
    
    // Add additional context for network-specific errors
    if (normalizedError.code === ERROR_CODES.UNKNOWN_ERROR) {
      // Check if it's a network error that we can categorize better
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // More comprehensive network error detection
        if (errorMessage.includes('failed to fetch') ||
            errorMessage.includes('network error') ||
            errorMessage.includes('err_network') ||
            errorMessage.includes('err_internet_disconnected') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout')) {
          
          return new ApiError(
            'Connection lost. Your changes will be saved offline.',
            ERROR_CODES.NETWORK_OFFLINE,
            true,
            { 
              operation, 
              originalError: error.message,
              timestamp: Date.now()
            }
          );
        }
        
        // Server errors that should be retryable
        if (errorMessage.includes('500') ||
            errorMessage.includes('502') ||
            errorMessage.includes('503') ||
            errorMessage.includes('504')) {
          
          return new ApiError(
            'Server temporarily unavailable. Will retry automatically.',
            ERROR_CODES.SERVER_ERROR,
            true,
            { 
              operation, 
              originalError: error.message,
              timestamp: Date.now()
            }
          );
        }
      }
    }

    return normalizedError;
  }

  private handleErrorToast(error: ApiError, allowRetry: boolean = true) {
    const message = getUserFriendlyMessage(error);

    // Different toast styles based on error type
    if (error.code === ERROR_CODES.QUEUED_OFFLINE) {
      toast({
        title: "Saved Offline",
        description: message,
        variant: "default"
      });
      
    } else if (error.code === ERROR_CODES.NETWORK_OFFLINE) {
      toast({
        title: "Connection Issue",
        description: message,
        variant: "default",
        action: allowRetry ? {
          altText: "Retry now",
          children: "Retry",
          onClick: () => {
            // Trigger network retry
            if (window.networkContext?.retryNow) {
              window.networkContext.retryNow().catch(console.error);
            }
          }
        } as any : undefined
      });
      
    } else if (error.retryable && allowRetry) {
      toast({
        title: "Temporary Issue",
        description: message,
        variant: "default",
        action: {
          altText: "Retry now",
          children: "Retry",
          onClick: () => {
            // This will be handled by the calling component's retry mechanism
            console.log('Retry requested for:', error.details?.operation);
          }
        } as any
      });
      
    } else if (error.code === ERROR_CODES.VALIDATION_ERROR) {
      // Don't show toast for validation errors - these should be handled by forms
      console.warn('Validation error:', message);
      
    } else {
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  }

  // Specific methods for different operation types
  async createWithOfflineSupport<T>(
    createFn: () => Promise<T>,
    entityName: string,
    options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {}
  ): Promise<T> {
    return this.execute(createFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} saved successfully`,
      operation: `create ${entityName}`,
      retryable: true
    });
  }

  async updateWithOfflineSupport<T>(
    updateFn: () => Promise<T>,
    entityName: string,
    options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {}
  ): Promise<T> {
    return this.execute(updateFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} updated successfully`,
      operation: `update ${entityName}`,
      retryable: true
    });
  }

  async deleteWithConfirmation<T>(
    deleteFn: () => Promise<T>,
    entityName: string,
    options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {}
  ): Promise<T> {
    return this.execute(deleteFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} deleted successfully`,
      operation: `delete ${entityName}`,
      requireOnline: true, // Deletes typically require immediate confirmation
      retryable: false // Don't auto-retry deletes
    });
  }

  async readWithRetry<T>(
    readFn: () => Promise<T>,
    operationName: string = 'fetch data',
    options: NetworkAwareAPIOptions = {}
  ): Promise<T> {
    return this.execute(readFn, {
      ...options,
      operation: operationName,
      requireOnline: true, // Reads need current data
      retryable: true,
      showErrorToast: false // Let the calling component handle read errors
    });
  }

  // Utility method to check network status and show appropriate messages
  checkNetworkAndWarn(operationName: string = 'this operation'): boolean {
    if (!navigator.onLine) {
      toast({
        title: "Offline",
        description: `Cannot perform ${operationName} while offline. Changes will be saved locally.`,
        variant: "default"
      });
      return false;
    }
    return true;
  }
}

// Export singleton instance
export const networkAPI = NetworkAwareAPI.getInstance();

// Global reference for toast actions
if (typeof window !== 'undefined') {
  (window as any).networkAPI = networkAPI;
}
