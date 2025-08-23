
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createConnectivity, NetStatus, ConnectivityListener } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';

interface NetworkContextValue {
  online: boolean;
  status: NetStatus;
  lastChangeAt: number;
  retryNow(): void;
  getDiagnostics?(): any;
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
  const [status, setStatus] = useState<NetStatus>(() => {
    const initialStatus = monitor.get();
    // Ensure consecutiveFailures is always defined
    return {
      online: initialStatus.online,
      lastCheck: initialStatus.lastCheck,
      consecutiveFailures: initialStatus.consecutiveFailures || 0,
      lastError: initialStatus.lastError
    };
  });
  const [lastChangeAt, setLastChangeAt] = useState<number>(Date.now());

  useEffect(() => {
    const unsubscribe = monitor.subscribe((newStatus) => {
      const wasOffline = !status.online;
      const statusChanged = status.online !== newStatus.online;

      // Ensure consecutiveFailures is always defined
      const safeStatus: NetStatus = {
        online: newStatus.online,
        lastCheck: newStatus.lastCheck,
        consecutiveFailures: newStatus.consecutiveFailures || 0,
        lastError: newStatus.lastError
      };

      setStatus(safeStatus);

      // Update lastChangeAt timestamp when online status changes
      if (statusChanged) {
        setLastChangeAt(Date.now());
      }

      // Sync with API client
      apiClient.setOnlineStatus(safeStatus.online);

      // Show toast when connection is restored
      if (wasOffline && safeStatus.online) {
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

  const getDiagnostics = useCallback(() => {
    // Return diagnostics from monitor if available
    return (monitor as any).getDiagnostics?.() || {};
  }, [monitor]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    status,
    lastChangeAt,
    retryNow,
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