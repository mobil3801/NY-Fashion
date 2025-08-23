
import { apiClient } from './client';
import { useNetwork } from '@/contexts/NetworkContext';
import { toast } from '@/hooks/use-toast';
import { ERROR_CODES, getUserFriendlyMessage, ApiError } from '@/lib/errors';

interface NetworkAwareAPIOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  skipOfflineQueue?: boolean;
  requireOnline?: boolean;
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
  options: NetworkAwareAPIOptions = {})
  : Promise<T> {
    const {
      showSuccessToast = false,
      showErrorToast = true,
      successMessage,
      skipOfflineQueue = false,
      requireOnline = false
    } = options;

    try {
      // Check if operation requires online connection
      if (requireOnline && !navigator.onLine) {
        throw new ApiError(
          'This operation requires an active internet connection',
          ERROR_CODES.NETWORK_OFFLINE,
          true
        );
      }

      const result = await operation();

      if (showSuccessToast && successMessage) {
        toast({
          title: "Success",
          description: successMessage,
          variant: "default"
        });
      }

      return result;
    } catch (error) {
      const normalizedError = this.normalizeError(error);

      if (showErrorToast) {
        this.handleErrorToast(normalizedError);
      }

      throw normalizedError;
    }
  }

  private normalizeError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for network-related errors (more comprehensive)
      if (error.name === 'TypeError' ||
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('ERR_NETWORK') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        return new ApiError(
          'Connection lost. Your changes will be saved offline.',
          ERROR_CODES.NETWORK_OFFLINE,
          true
        );
      }

      // Check for timeout errors (more comprehensive)
      if (error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('aborted') ||
      error.message.includes('The operation was aborted')) {
        return new ApiError(
          'Request timeout. Please check your connection and try again.',
          ERROR_CODES.TIMEOUT,
          true
        );
      }

      // Check for server errors that might be retryable
      if (error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')) {
        return new ApiError(
          'Server temporarily unavailable. Will retry automatically.',
          ERROR_CODES.SERVER_ERROR,
          true
        );
      }

      return new ApiError(
        error.message,
        ERROR_CODES.UNKNOWN_ERROR,
        false
      );
    }

    return new ApiError(
      'An unexpected error occurred',
      ERROR_CODES.UNKNOWN_ERROR,
      false
    );
  }

  private handleErrorToast(error: ApiError, retryFn?: () => Promise<void>) {
    const message = getUserFriendlyMessage(error);

    // Different toast styles based on error type
    if (error.code === ERROR_CODES.QUEUED_OFFLINE) {
      toast({
        title: "Saved Offline",
        description: message,
        variant: "default"
      });
    } else if (error.retryable) {
      toast({
        title: "Connection Issue",
        description: message,
        variant: "default",
        action: retryFn ? {
          altText: "Retry now",
          children: "Retry",
          onClick: async () => {
            try {
              await retryFn();
              toast({
                title: "Retry Successful",
                description: "Operation completed successfully",
                variant: "default"
              });
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }
        } as any : undefined
      });
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
  options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {})
  : Promise<T> {
    return this.execute(createFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} saved successfully`
    });
  }

  async updateWithOfflineSupport<T>(
  updateFn: () => Promise<T>,
  entityName: string,
  options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {})
  : Promise<T> {
    return this.execute(updateFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} updated successfully`
    });
  }

  async deleteWithConfirmation<T>(
  deleteFn: () => Promise<T>,
  entityName: string,
  options: Omit<NetworkAwareAPIOptions, 'successMessage'> = {})
  : Promise<T> {
    return this.execute(deleteFn, {
      ...options,
      showSuccessToast: true,
      successMessage: `${entityName} deleted successfully`,
      requireOnline: true // Deletes typically require immediate confirmation
    });
  }

  async readWithRetry<T>(
  readFn: () => Promise<T>,
  options: NetworkAwareAPIOptions = {})
  : Promise<T> {
    return this.execute(readFn, {
      ...options,
      requireOnline: true // Reads need current data
    });
  }
}

export const networkAPI = NetworkAwareAPI.getInstance();