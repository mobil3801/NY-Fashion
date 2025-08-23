
import { useCallback, useEffect } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { apiClient } from '@/lib/network/client';
import { useToast } from './use-toast';

export function useNetworkApi() {
  const { online } = useNetwork();
  const { toast } = useToast();

  // Update API client when network status changes
  useEffect(() => {
    apiClient.setOnlineStatus(online);
  }, [online]);

  const executeWithOfflineHandling = useCallback(
    async <T,>(
    operation: () => Promise<T>,
    options: {
      successMessage?: string;
      errorMessage?: string;
      offlineMessage?: string;
    } = {})
    : Promise<T | null> => {
      try {
        const result = await operation();

        if (options.successMessage) {
          toast({
            title: "Success",
            description: options.successMessage
          });
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          // Handle offline queue scenario
          if (error.message.includes('will sync when online')) {
            toast({
              title: "Saved offline",
              description: options.offlineMessage || "Changes will sync when connection is restored",
              variant: "default"
            });
            return null;
          }
        }

        // Handle other errors
        toast({
          title: "Error",
          description: options.errorMessage || "An unexpected error occurred",
          variant: "destructive"
        });

        throw error;
      }
    },
    [online, toast]
  );

  return {
    online,
    executeWithOfflineHandling,
    queueStatus: apiClient.getQueueStatus(),
    clearQueue: apiClient.clearQueue.bind(apiClient)
  };
}