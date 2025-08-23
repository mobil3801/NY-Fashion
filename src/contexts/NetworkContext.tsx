
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createConnectivity, NetStatus, ConnectivityListener } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';
import { NetworkErrorClassifier } from '@/lib/network/error-classifier';
import {
  EnhancedNetStatus,
  ConnectionState,
  ConnectionErrorType,
  ConnectionRecoveryInfo } from
'@/types/network';
import { useNetworkRetry } from '@/hooks/use-network-retry';

interface NetworkContextValue {
  online: boolean;
  status: EnhancedNetStatus;
  lastChangeAt: number;
  connectionState: ConnectionState;
  errorDetails: ReturnType<typeof NetworkErrorClassifier.classifyError> | null;
  recoveryInfo: ConnectionRecoveryInfo | null;
  retryNow(): Promise<void>;
  abortRetry(): void;
  getDiagnostics?(): any;
  isAutoRetrying: boolean;
  retryCount: number;
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
  const [status, setStatus] = useState<EnhancedNetStatus>(() => {
    const initialStatus = monitor.get();
    // Ensure consecutiveFailures is always defined
    return {
      online: initialStatus.online,
      lastCheck: initialStatus.lastCheck,
      consecutiveFailures: initialStatus.consecutiveFailures || 0,
      lastError: initialStatus.lastError,
      state: initialStatus.online ? 'online' : 'offline',
      retryAttempts: 0
    };
  });
  const [lastChangeAt, setLastChangeAt] = useState<number>(Date.now());
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    status.online ? 'online' : 'offline'
  );
  const [errorDetails, setErrorDetails] = useState<ReturnType<typeof NetworkErrorClassifier.classifyError> | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<ConnectionRecoveryInfo | null>(null);
  const offlineStartTimeRef = useRef<number | null>(null);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto retry functionality
  const {
    executeWithRetry,
    abortRetry,
    isRetrying: isAutoRetrying,
    retryCount,
    currentError
  } = useNetworkRetry({
    maxRetries: 3,
    onRetryAttempt: (attempt, errorType) => {
      console.log(`Auto-retry attempt ${attempt} for ${errorType}`);
      setConnectionState('reconnecting');
    },
    onMaxRetriesReached: (errorType) => {
      console.warn(`Max auto-retries reached for ${errorType}`);
      setConnectionState('offline');
    },
    onSuccess: () => {
      setConnectionState('online');
      import('@/hooks/use-toast').then(({ toast }) => {
        toast({
          title: "Connection Restored",
          description: "Successfully reconnected to the server.",
          variant: "default"
        });
      }).catch((error) => {
        console.warn('Failed to load toast notification:', error);
      });
    }
  });

  useEffect(() => {
    const unsubscribe = monitor.subscribe((newStatus) => {
      const wasOffline = !status.online;
      const statusChanged = status.online !== newStatus.online;
      const now = Date.now();

      // Track offline duration
      if (statusChanged) {
        if (!newStatus.online && !offlineStartTimeRef.current) {
          offlineStartTimeRef.current = now;
        } else if (newStatus.online && offlineStartTimeRef.current) {
          const offlineDuration = now - offlineStartTimeRef.current;
          setRecoveryInfo({
            wasOfflineFor: offlineDuration,
            recoveryTime: new Date(),
            failureCount: newStatus.consecutiveFailures || 0
          });
          offlineStartTimeRef.current = null;
        }
      }

      // Classify error if present
      let errorClassification = null;
      if (newStatus.lastError) {
        errorClassification = NetworkErrorClassifier.classifyError(new Error(newStatus.lastError));
        setErrorDetails(errorClassification);
      } else {
        setErrorDetails(null);
      }

      // Determine connection state
      let newConnectionState: ConnectionState = 'online';
      if (!newStatus.online) {
        if (isAutoRetrying) {
          newConnectionState = 'reconnecting';
        } else if (errorClassification?.type === 'timeout') {
          newConnectionState = 'poor_connection';
        } else {
          newConnectionState = 'offline';
        }
      } else if (wasOffline) {
        newConnectionState = 'recovering';
        // Auto-transition from recovering to online after a short delay
        setTimeout(() => setConnectionState('online'), 2000);
      }

      // Ensure consecutiveFailures is always defined
      const safeStatus: EnhancedNetStatus = {
        online: newStatus.online,
        lastCheck: newStatus.lastCheck,
        consecutiveFailures: newStatus.consecutiveFailures || 0,
        lastError: newStatus.lastError,
        errorType: errorClassification?.type,
        state: newConnectionState,
        retryAttempts: retryCount
      };

      setStatus(safeStatus);
      setConnectionState(newConnectionState);

      // Update lastChangeAt timestamp when online status changes
      if (statusChanged) {
        setLastChangeAt(now);
      }

      // Sync with API client
      apiClient.setOnlineStatus(safeStatus.online);

      // Handle connection restoration with enhanced messaging
      if (wasOffline && safeStatus.online) {
        const offlineDuration = offlineStartTimeRef.current ? now - offlineStartTimeRef.current : 0;

        import('@/hooks/use-toast').then(({ toast }) => {
          let description = "You're back online. Syncing your changes...";

          if (offlineDuration > 60000) {// > 1 minute
            const minutes = Math.round(offlineDuration / 60000);
            description = `Reconnected after ${minutes} minute${minutes > 1 ? 's' : ''}. Syncing your changes...`;
          } else if (offlineDuration > 5000) {// > 5 seconds
            const seconds = Math.round(offlineDuration / 1000);
            description = `Reconnected after ${seconds} seconds. Syncing your changes...`;
          }

          toast({
            title: "Connection Restored",
            description,
            variant: "default"
          });
        }).catch((error) => {
          console.warn('Failed to show connection restored notification:', error);
        });

        // Clear error details on successful reconnection
        setErrorDetails(null);

        // Flush any queued operations when coming back online
        apiClient.flushQueue?.();
      }

      // Auto-retry logic for certain error types
      if (!newStatus.online && errorClassification?.isRetryable && !isAutoRetrying) {
        const shouldAutoRetry = NetworkErrorClassifier.shouldShowBanner(
          errorClassification.type,
          newStatus.consecutiveFailures || 0
        );

        if (shouldAutoRetry && retryCount < 3) {
          const delay = NetworkErrorClassifier.getRetryDelay(errorClassification.type, retryCount + 1);

          autoRetryTimeoutRef.current = setTimeout(() => {
            executeWithRetry(async () => {
              await monitor.checkNow();
            }, 'Auto network check');
          }, delay);
        }
      }
    });

    // Initial sync
    apiClient.setOnlineStatus(status.online);
    monitor.start();

    return () => {
      unsubscribe();
      monitor.stop();
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
    };
  }, [monitor, status.online, executeWithRetry, isAutoRetrying, retryCount]);

  const retryNow = useCallback(async () => {
    // Clear any existing auto-retry timeout
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = undefined;
    }

    setConnectionState('reconnecting');

    try {
      await executeWithRetry(async () => {
        // Trigger immediate connectivity check
        await monitor.pingNow();

        // Signal retry scheduler for any pending operations
        apiClient.retryNow?.();

        // Flush queue if online
        if (status.online) {
          apiClient.flushQueue?.();
        }
      }, 'Manual retry');
    } catch (error) {
      console.error('Manual retry failed:', error);

      // Show error toast
      import('@/hooks/use-toast').then(({ toast }) => {
        const errorDetails = NetworkErrorClassifier.classifyError(error);
        toast({
          title: "Retry Failed",
          description: errorDetails.userMessage,
          variant: "destructive"
        });
      }).catch((toastError) => {
        console.warn('Failed to show retry failed notification:', toastError);
        // Fallback to console error for debugging
        console.error('Retry failed:', error);
      });
    }
  }, [monitor, status.online, executeWithRetry]);

  const getDiagnostics = useCallback(() => {
    // Return diagnostics from monitor if available
    return (monitor as any).getDiagnostics?.() || {};
  }, [monitor]);

  const contextValue: NetworkContextValue = {
    online: status.online,
    status,
    lastChangeAt,
    connectionState,
    errorDetails,
    recoveryInfo,
    retryNow,
    abortRetry,
    getDiagnostics,
    isAutoRetrying,
    retryCount
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