
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createConnectivity, NetStatus, ConnectivityListener } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';

interface NetworkContextValue {
  online: boolean;
  lastChangeAt: number;
  retryNow(): void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

interface NetworkProviderProps {
  children: React.ReactNode;
  config?: {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
  };
}

export function NetworkProvider({ children, config }: NetworkProviderProps) {
  const [monitor] = useState(() => createConnectivity(config));
  const [status, setStatus] = useState<NetStatus>(monitor.get());
  const [lastChangeAt, setLastChangeAt] = useState<number>(Date.now());

  useEffect(() => {
    const unsubscribe = monitor.subscribe((newStatus) => {
      const wasOffline = !status.online;
      const statusChanged = status.online !== newStatus.online;

      setStatus(newStatus);

      // Update lastChangeAt timestamp when online status changes
      if (statusChanged) {
        setLastChangeAt(Date.now());
      }

      // Sync with API client
      apiClient.setOnlineStatus(newStatus.online);

      // Show toast when connection is restored
      if (wasOffline && newStatus.online) {
        // Import toast dynamically to avoid circular dependencies
        import('@/hooks/use-toast').then(({ toast }) => {
          toast({
            title: "Connection Restored",
            description: "You're back online. Syncing your changes...",
            variant: "default"
          });
        });

        // Flush any queued operations when coming back online
        apiClient.flushQueue?.();
      }
    });

    // Initial sync
    apiClient.setOnlineStatus(status.online);
    monitor.start();

    return () => {
      unsubscribe();
      monitor.stop();
    };
  }, [monitor, status.online]);

  const retryNow = useCallback(() => {
    // Trigger immediate connectivity check
    monitor.pingNow();

    // Signal retry scheduler for any pending operations
    apiClient.retryNow?.();

    // Flush queue if online
    if (status.online) {
      apiClient.flushQueue?.();
    }
  }, [monitor, status.online]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    lastChangeAt,
    retryNow
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>);

}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export function useOnlineStatus(): boolean {
  const { online } = useNetwork();
  return online;
}