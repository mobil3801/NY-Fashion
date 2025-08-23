
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ConnectivityMonitor, NetStatus } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';
import { toast } from '@/hooks/use-toast';

interface NetworkContextValue {
  online: boolean;
  status: NetStatus;
  retryNow: () => Promise<void>;
  monitor: ConnectivityMonitor;
  getDiagnostics: () => any;
  isConnecting: boolean;
  lastConnectedAt?: Date;
  connectionQuality: 'good' | 'poor' | 'offline';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date>();
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('offline');

  const determineConnectionQuality = useCallback((newStatus: NetStatus): 'good' | 'poor' | 'offline' => {
    if (!newStatus.online) return 'offline';
    
    const diagnostics = monitor.getDiagnostics();
    if (diagnostics.averageLatency < 500 && newStatus.consecutiveFailures === 0) return 'good';
    if (diagnostics.averageLatency < 2000 || newStatus.consecutiveFailures <= 2) return 'poor';
    return 'offline';
  }, [monitor]);

  useEffect(() => {
    const unsubscribe = monitor.addListener((newStatus) => {
      const wasOffline = !status.online;
      const wasConnecting = isConnecting;
      
      setStatus(newStatus);
      setConnectionQuality(determineConnectionQuality(newStatus));

      // Update API client network status
      apiClient.setOnlineStatus(newStatus.online);

      // Handle connection state changes
      if (wasOffline && newStatus.online) {
        // Connection restored
        setLastConnectedAt(new Date());
        setIsConnecting(false);

        toast({
          title: "Connection Restored",
          description: "You're back online. Syncing your changes...",
          variant: "default"
        });

        // Flush offline queue
        setTimeout(() => {
          apiClient.flushOfflineQueue().catch(console.error);
        }, 500);

      } else if (!wasOffline && !newStatus.online) {
        // Connection lost
        toast({
          title: "Connection Lost",
          description: "Working offline. Changes will sync when connection returns.",
          variant: "default"
        });

      } else if (wasConnecting && newStatus.online) {
        // Retry successful
        setIsConnecting(false);
        toast({
          title: "Connection Restored",
          description: "Successfully reconnected to the server.",
          variant: "default"
        });
      }
    });

    // Initial sync with API client
    apiClient.setOnlineStatus(status.online);

    return () => {
      unsubscribe();
      monitor.destroy();
    };
  }, [monitor, status.online, isConnecting, determineConnectionQuality]);

  const retryNow = useCallback(async () => {
    if (isConnecting) return; // Prevent multiple simultaneous retry attempts

    setIsConnecting(true);
    
    try {
      // Force immediate connectivity check
      await monitor.checkNow();
      
      // If we're back online, try to flush the offline queue
      if (status.online) {
        await apiClient.flushOfflineQueue();
      }
    } catch (error) {
      console.error('Retry connection failed:', error);
      
      // Show error toast only if we're still having issues
      setTimeout(() => {
        if (!status.online) {
          toast({
            title: "Connection Failed",
            description: "Unable to restore connection. Please check your network settings.",
            variant: "destructive"
          });
        }
      }, 1000);
    } finally {
      // Reset connecting state after a delay
      setTimeout(() => {
        setIsConnecting(false);
      }, 2000);
    }
  }, [monitor, status.online, isConnecting]);

  const getDiagnostics = useCallback(() => {
    return {
      connectivity: monitor.getDiagnostics(),
      apiClient: apiClient.getNetworkDiagnostics(),
      connectionQuality,
      isConnecting,
      lastConnectedAt
    };
  }, [monitor, connectionQuality, isConnecting, lastConnectedAt]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    status,
    retryNow,
    monitor,
    getDiagnostics,
    isConnecting,
    lastConnectedAt,
    connectionQuality
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
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
