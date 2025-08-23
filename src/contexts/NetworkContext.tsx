
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ConnectivityMonitor, NetStatus } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';

interface NetworkContextValue {
  online: boolean;
  status: NetStatus;
  retryNow: () => Promise<void>;
  monitor: ConnectivityMonitor;
  getDiagnostics: () => any;
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
  const [monitor] = useState(() => new ConnectivityMonitor(config));
  const [status, setStatus] = useState<NetStatus>(monitor.getStatus());

  useEffect(() => {
    const unsubscribe = monitor.addListener((newStatus) => {
      const wasOffline = !status.online;
      setStatus(newStatus);
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
      }
    });

    // Initial sync
    apiClient.setOnlineStatus(status.online);

    return () => {
      unsubscribe();
      monitor.destroy();
    };
  }, [monitor, status.online]);

  const retryNow = useCallback(async () => {
    await monitor.checkNow();
  }, [monitor]);

  const getDiagnostics = useCallback(() => {
    return {
      connectivity: monitor.getDiagnostics(),
      apiClient: apiClient.getNetworkDiagnostics()
    };
  }, [monitor]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    status,
    retryNow,
    monitor,
    getDiagnostics
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