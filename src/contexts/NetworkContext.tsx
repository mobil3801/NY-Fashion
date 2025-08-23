
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ConnectivityMonitor, NetStatus } from '@/lib/network/connectivity';

interface NetworkContextValue {
  online: boolean;
  status: NetStatus;
  retryNow: () => Promise<void>;
  monitor: ConnectivityMonitor;
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
    const unsubscribe = monitor.addListener(setStatus);

    return () => {
      unsubscribe();
      monitor.destroy();
    };
  }, [monitor]);

  const retryNow = useCallback(async () => {
    await monitor.checkNow();
  }, [monitor]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    status,
    retryNow,
    monitor,
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
