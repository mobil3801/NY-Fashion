import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createConnectivity } from '@/lib/network/connectivity';
import { apiClient } from '@/lib/network/client';
import { NetworkErrorClassifier } from '@/lib/network/error-classifier';
import { NetworkStatus, ConnectionQuality } from '@/types/network';
import { useNetworkRetry } from '@/hooks/use-network-retry';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/production-logger';
import { PRODUCTION_CONFIG } from '@/config/production';

interface NetworkContextType {
  // Connection state
  isOnline: boolean;
  isConnected: boolean;
  connectionQuality: ConnectionQuality;
  networkStatus: NetworkStatus;

  // Connection metrics
  latency: number;
  bandwidth: number;
  signalStrength: number;

  // API state
  pendingRequests: number;
  failedRequests: number;
  lastSuccessfulRequest: Date | null;

  // Queue state
  queuedOperations: number;
  isProcessingQueue: boolean;

  // Error handling
  lastError: Error | null;
  connectionErrors: number;

  // Methods
  checkConnection: () => Promise<boolean>;
  clearErrors: () => void;
  retryFailedRequests: () => Promise<void>;
  getConnectionDiagnostics: () => Promise<any>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export const useOnlineStatus = () => {
  const { isOnline } = useNetwork();
  return isOnline;
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('unknown');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('connecting');

  // Connection metrics
  const [latency, setLatency] = useState(0);
  const [bandwidth, setBandwidth] = useState(0);
  const [signalStrength, setSignalStrength] = useState(0);

  // API state
  const [pendingRequests, setPendingRequests] = useState(0);
  const [failedRequests, setFailedRequests] = useState(0);
  const [lastSuccessfulRequest, setLastSuccessfulRequest] = useState<Date | null>(null);

  // Queue state
  const [queuedOperations, setQueuedOperations] = useState(0);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Error handling
  const [lastError, setLastError] = useState<Error | null>(null);
  const [connectionErrors, setConnectionErrors] = useState(0);

  const { toast } = useToast();
  const { retryWithBackoff } = useNetworkRetry();

  const connectivity = createConnectivity();

  // Initialize network monitoring
  useEffect(() => {
    initializeNetworkMonitoring();
    return () => cleanupNetworkMonitoring();
  }, []);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.logInfo('Network connection restored');
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      setNetworkStatus('disconnected');
      logger.logWarn('Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic connection checking
  useEffect(() => {
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const initializeNetworkMonitoring = () => {
    logger.logInfo('Initializing network monitoring');

    // Initial connection check
    checkConnection();

    // Monitor connection quality if supported
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      updateConnectionMetrics(connection);

      connection.addEventListener('change', () => {
        updateConnectionMetrics(connection);
      });
    }

    // Monitor API client events
    setupApiClientMonitoring();
  };

  const cleanupNetworkMonitoring = () => {
    logger.logInfo('Cleaning up network monitoring');
  };

  const updateConnectionMetrics = (connection: any) => {
    if (connection) {
      setBandwidth(connection.downlink || 0);
      setSignalStrength(connection.effectiveType ? getSignalStrength(connection.effectiveType) : 0);

      const quality = determineConnectionQuality(connection.effectiveType, connection.downlink);
      setConnectionQuality(quality);

      logger.logInfo('Connection metrics updated', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        quality
      });
    }
  };

  const getSignalStrength = (effectiveType: string): number => {
    switch (effectiveType) {
      case '4g':return 100;
      case '3g':return 75;
      case '2g':return 50;
      case 'slow-2g':return 25;
      default:return 0;
    }
  };

  const determineConnectionQuality = (effectiveType: string, downlink: number): ConnectionQuality => {
    if (!effectiveType) return 'unknown';

    if (effectiveType === '4g' && downlink > 10) return 'excellent';
    if (effectiveType === '4g' && downlink > 2) return 'good';
    if (effectiveType === '3g') return 'fair';
    if (effectiveType === '2g') return 'poor';
    return 'poor';
  };

  const setupApiClientMonitoring = () => {
    // Monitor API request lifecycle
    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      setPendingRequests((prev) => prev + 1);
      const startTime = performance.now();

      try {
        const response = await originalFetch(input, init);

        const duration = performance.now() - startTime;
        setLatency(duration);

        if (response.ok) {
          setLastSuccessfulRequest(new Date());
          setConnectionErrors(0);

          if (!isConnected) {
            setIsConnected(true);
            setNetworkStatus('connected');
            logger.logInfo('API connectivity restored');
          }
        } else {
          handleApiError(new Error(`HTTP ${response.status}`));
        }

        return response;
      } catch (error) {
        handleApiError(error as Error);
        throw error;
      } finally {
        setPendingRequests((prev) => Math.max(0, prev - 1));
      }
    };
  };

  const handleApiError = (error: Error) => {
    const errorType = NetworkErrorClassifier.classifyError(error);
    setFailedRequests((prev) => prev + 1);
    setLastError(error);

    if (errorType.isNetworkError || errorType.isTimeoutError) {
      setConnectionErrors((prev) => prev + 1);
      setIsConnected(false);
      setNetworkStatus('error');

      logger.logError('Network API error', error, {
        errorType,
        connectionErrors: connectionErrors + 1
      });

      // Show user-friendly error message
      if (connectionErrors >= 3) {
        toast({
          title: 'Connection Issues',
          description: 'Having trouble connecting to the server. Please check your internet connection.',
          variant: 'destructive'
        });
      }
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      setNetworkStatus('checking');
      logger.logInfo('Checking network connection');

      const startTime = performance.now();
      const isConnectedNow = await connectivity.checkConnection();
      const duration = performance.now() - startTime;

      setLatency(duration);
      setIsConnected(isConnectedNow);
      setNetworkStatus(isConnectedNow ? 'connected' : 'disconnected');

      if (isConnectedNow) {
        setLastSuccessfulRequest(new Date());
        setConnectionErrors(0);
        logger.logInfo('Connection check successful', { latency: duration });
      } else {
        logger.logWarn('Connection check failed', { latency: duration });
      }

      return isConnectedNow;
    } catch (error) {
      logger.logError('Connection check error', error);
      setIsConnected(false);
      setNetworkStatus('error');
      setConnectionErrors((prev) => prev + 1);
      return false;
    }
  };

  const clearErrors = () => {
    setLastError(null);
    setFailedRequests(0);
    setConnectionErrors(0);
    logger.logInfo('Network errors cleared');
  };

  const retryFailedRequests = async () => {
    if (!isConnected) {
      throw new Error('No network connection available');
    }

    setIsProcessingQueue(true);
    try {
      logger.logInfo('Retrying failed requests');

      // Process any queued operations
      if (connectivity && typeof connectivity.processQueue === 'function') {
        await connectivity.processQueue();
      } else {
        // Fallback to offlineQueue direct access
        try {
          const { offlineQueue } = await import('@/lib/offlineQueue');
          await offlineQueue.processAll();
        } catch (fallbackError) {
          console.warn('Failed to process queue:', fallbackError);
        }
      }

      setQueuedOperations(0);
      clearErrors();

      toast({
        title: 'Requests Retried',
        description: 'Successfully retried pending operations.',
        variant: 'default'
      });

    } catch (error) {
      logger.logError('Failed to retry requests', error);
      throw error;
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const getConnectionDiagnostics = async () => {
    const diagnostics = {
      // Basic connectivity
      isOnline,
      isConnected,
      networkStatus,
      connectionQuality,

      // Performance metrics
      latency,
      bandwidth,
      signalStrength,

      // Request metrics
      pendingRequests,
      failedRequests,
      lastSuccessfulRequest,

      // Queue metrics
      queuedOperations,
      isProcessingQueue,

      // Error metrics
      connectionErrors,
      lastError: lastError?.message,

      // Browser info
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,

      // Connection info (if available)
      connectionType: (navigator as any).connection?.effectiveType,
      connectionSaveData: (navigator as any).connection?.saveData,

      // Timing
      timestamp: new Date().toISOString(),
      uptime: performance.now()
    };

    logger.logInfo('Connection diagnostics generated', diagnostics);
    return diagnostics;
  };

  // Update queue count periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Try to get queue size from connectivity
        if (connectivity && typeof connectivity.getQueueSize === 'function') {
          const queueSize = await connectivity.getQueueSize();
          setQueuedOperations(queueSize);
        } else {
          // Fallback to offlineQueue direct access
          try {
            const { offlineQueue } = await import('@/lib/offlineQueue');
            const queueSize = await offlineQueue.size();
            setQueuedOperations(queueSize);
          } catch (fallbackError) {
            console.warn('Failed to get queue size:', fallbackError);
            setQueuedOperations(0);
          }
        }
      } catch (error) {
        // Final fallback - set to 0
        setQueuedOperations(0);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [connectivity]);

  const contextValue: NetworkContextType = {
    // Connection state
    isOnline,
    isConnected,
    connectionQuality,
    networkStatus,

    // Connection metrics
    latency,
    bandwidth,
    signalStrength,

    // API state
    pendingRequests,
    failedRequests,
    lastSuccessfulRequest,

    // Queue state
    queuedOperations,
    isProcessingQueue,

    // Error handling
    lastError,
    connectionErrors,

    // Methods
    checkConnection,
    clearErrors,
    retryFailedRequests,
    getConnectionDiagnostics
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>);

};