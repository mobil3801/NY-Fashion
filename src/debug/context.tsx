import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { ApiError } from '@/lib/errors';

// Basic debug types from legacy context
interface DebugLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  data?: unknown;
}

interface DebugInfo {
  environment: string;
  buildMode: string;
  userAgent: string;
  timestamp: number;
  memoryUsage?: MemoryInfo;
}

// Network monitoring types
interface NetworkStatus {
  isOnline: boolean;
  latency: number | null;
  lastCheck: Date;
  connectionType?: string;
  downlink?: number;
}

// API call tracking types
interface ApiCall {
  id: string;
  timestamp: Date;
  operation: string;
  method: string;
  url: string;
  attempt: number;
  duration: number | null;
  status: 'pending' | 'success' | 'error' | 'retrying';
  error?: ApiError;
  response?: any;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

// Debug settings types
interface DebugSettings {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'none';
  maxApiCalls: number;
  simulateNetworkConditions: 'none' | 'slow' | 'offline' | 'intermittent';
  retryOverrides: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  enableNetworkLogging: boolean;
  enablePerformanceTracking: boolean;
}

// Consolidated debug context interface
interface DebugContextType {
  // Basic debug functionality (from legacy debug provider)
  debugMode: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  enableNetworkLogging: boolean;
  enablePerformanceTracking: boolean;
  addLog: (level: string, message: string, data?: unknown) => void;
  clearLogs: () => void;
  getLogs: () => DebugLog[];
  getDebugInfo: () => DebugInfo;

  // Network status monitoring (from advanced debug context)
  networkStatus: NetworkStatus;
  checkNetworkStatus: () => Promise<void>;

  // API monitoring
  apiCalls: ApiCall[];
  addApiCall: (call: Omit<ApiCall, 'id'>) => string;
  updateApiCall: (id: string, updates: Partial<ApiCall>) => void;
  clearApiCalls: () => void;

  // Debug settings (consolidated)
  debugSettings: DebugSettings;
  updateDebugSettings: (updates: Partial<DebugSettings>) => void;

  // Recovery tools
  retryFailedCall: (callId: string) => Promise<void>;
  clearCache: () => void;

  // Testing utilities
  simulateNetworkFailure: (duration: number) => void;
  runNetworkBenchmark: () => Promise<{latency: number;bandwidth: number;}>;
}

// Default debug settings
const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'info',
  maxApiCalls: 100,
  simulateNetworkConditions: 'none',
  retryOverrides: {},
  enableNetworkLogging: true,
  enablePerformanceTracking: true
};

// Create context with undefined default (for proper error handling)
const DebugContext = createContext<DebugContextType | undefined>(undefined);

// Production-safe no-op implementation
const createNoOpDebugContext = (): DebugContextType => ({
  // Basic debug functionality
  debugMode: false,
  logLevel: 'none',
  enableNetworkLogging: false,
  enablePerformanceTracking: false,
  addLog: () => {},
  clearLogs: () => {},
  getLogs: () => [],
  getDebugInfo: () => ({
    environment: 'production',
    buildMode: 'production',
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  }),

  // Network status
  networkStatus: {
    isOnline: navigator.onLine,
    latency: null,
    lastCheck: new Date()
  },
  checkNetworkStatus: async () => {},

  // API monitoring
  apiCalls: [],
  addApiCall: () => '',
  updateApiCall: () => {},
  clearApiCalls: () => {},

  // Debug settings
  debugSettings: { ...DEFAULT_DEBUG_SETTINGS, enabled: false },
  updateDebugSettings: () => {},

  // Recovery tools
  retryFailedCall: async () => {},
  clearCache: () => {},

  // Testing utilities
  simulateNetworkFailure: () => {},
  runNetworkBenchmark: async () => ({ latency: 0, bandwidth: 0 })
});

// Custom hook with proper error handling
export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);

  if (context === undefined) {
    // In development, throw error to catch missing provider
    if (process.env.NODE_ENV === 'development') {
      throw new Error('useDebug must be used within a DebugProvider');
    }

    // In production, return safe defaults
    console.warn('[DebugProvider] useDebug called outside of DebugProvider, using no-op implementation');
    return createNoOpDebugContext();
  }

  return context;
};

// Debug provider props
interface DebugProviderProps {
  children: ReactNode;
}

// Main debug provider component
export const DebugProvider: React.FC<DebugProviderProps> = ({ children }) => {
  // Debug logs state (from legacy provider)
  const [logs, setLogs] = useState<DebugLog[]>([]);

  // Network status state
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    latency: null,
    lastCheck: new Date()
  });

  // API calls state
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);

  // Debug settings state
  const [debugSettings, setDebugSettings] = useState<DebugSettings>(DEFAULT_DEBUG_SETTINGS);

  // Refs for cleanup
  const networkCheckRef = useRef<number>();
  const simulationTimeoutRef = useRef<number>();

  // Environment check
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Basic debug functionality (from legacy provider)
  const addLog = useCallback((level: string, message: string, data?: unknown): void => {
    if (!debugSettings.enabled) return;

    const log: DebugLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      message,
      data
    };

    setLogs((prev) => {
      const updated = [log, ...prev];
      // Keep only last 1000 logs to prevent memory issues
      return updated.length > 1000 ? updated.slice(0, 1000) : updated;
    });

    // Also log to console in development
    if (isDevelopment && console[level as keyof Console]) {
      (console[level as keyof Console] as (...args: unknown[]) => void)(
        `[Debug] ${message}`,
        data || ''
      );
    }
  }, [debugSettings.enabled, isDevelopment]);

  const clearLogs = useCallback((): void => {
    setLogs([]);
  }, []);

  const getLogs = useCallback((): DebugLog[] => {
    return [...logs];
  }, [logs]);

  const getDebugInfo = useCallback((): DebugInfo => ({
    environment: process.env.NODE_ENV || 'development',
    buildMode: import.meta.env?.MODE || 'development',
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    memoryUsage: (performance as any)?.memory
  }), []);

  // Network status monitoring
  const checkNetworkStatus = useCallback(async (): Promise<void> => {
    if (!debugSettings.enabled) return;

    const startTime = performance.now();

    try {
      // Use health check endpoint for better reliability
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const latency = performance.now() - startTime;
      const connection = (navigator as any).connection;

      setNetworkStatus({
        isOnline: response.ok,
        latency,
        lastCheck: new Date(),
        connectionType: connection?.effectiveType,
        downlink: connection?.downlink
      });
    } catch (error) {
      setNetworkStatus((prev) => ({
        ...prev,
        isOnline: false,
        latency: null,
        lastCheck: new Date()
      }));
    }
  }, [debugSettings.enabled]);

  // API call tracking
  const addApiCall = useCallback((call: Omit<ApiCall, 'id'>): string => {
    if (!debugSettings.enabled) return '';

    const id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCall: ApiCall = { ...call, id };

    setApiCalls((prev) => {
      const updated = [newCall, ...prev].slice(0, debugSettings.maxApiCalls);
      return updated;
    });

    return id;
  }, [debugSettings.enabled, debugSettings.maxApiCalls]);

  const updateApiCall = useCallback((id: string, updates: Partial<ApiCall>): void => {
    if (!debugSettings.enabled) return;

    setApiCalls((prev) => prev.map((call) =>
    call.id === id ? { ...call, ...updates } : call
    ));
  }, [debugSettings.enabled]);

  const clearApiCalls = useCallback((): void => {
    setApiCalls([]);
  }, []);

  // Settings management
  const updateDebugSettings = useCallback((updates: Partial<DebugSettings>): void => {
    setDebugSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Recovery tools
  const retryFailedCall = useCallback(async (callId: string): Promise<void> => {
    if (!debugSettings.enabled) return;

    const call = apiCalls.find((c) => c.id === callId);
    if (!call || call.status === 'pending') return;

    updateApiCall(callId, { status: 'pending', attempt: call.attempt + 1 });

    try {
      const response = await fetch(call.url, {
        method: call.method,
        headers: call.requestHeaders
      });

      updateApiCall(callId, {
        status: 'success',
        duration: performance.now(),
        response: await response.json()
      });
    } catch (error) {
      updateApiCall(callId, {
        status: 'error',
        error: error as ApiError,
        duration: performance.now()
      });
    }
  }, [debugSettings.enabled, apiCalls, updateApiCall]);

  const clearCache = useCallback((): void => {
    if (!debugSettings.enabled) return;

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    // Clear localStorage debug data
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('debug_') || key.startsWith('api_')) {
        localStorage.removeItem(key);
      }
    });
  }, [debugSettings.enabled]);

  // Testing utilities
  const simulateNetworkFailure = useCallback((duration: number): void => {
    if (!debugSettings.enabled) return;

    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }

    // Override fetch to simulate failure
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      throw new Error('Simulated network failure');
    };

    simulationTimeoutRef.current = window.setTimeout(() => {
      window.fetch = originalFetch;
    }, duration);
  }, [debugSettings.enabled]);

  const runNetworkBenchmark = useCallback(async (): Promise<{latency: number;bandwidth: number;}> => {
    if (!debugSettings.enabled) {
      return { latency: 0, bandwidth: 0 };
    }

    const testSizes = [1, 10, 100]; // KB
    const results = [];

    for (const size of testSizes) {
      const startTime = performance.now();

      try {
        // Use a more reliable endpoint for benchmarking
        const response = await fetch(`/api/benchmark?size=${size}`, {
          cache: 'no-cache'
        });

        const data = await response.text();
        const endTime = performance.now();
        const duration = endTime - startTime;
        const bandwidth = size * 1024 / (duration / 1000); // bytes per second

        results.push({ latency: duration, bandwidth });
      } catch (error) {
        console.warn('Benchmark test failed for size:', size);
      }
    }

    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const avgBandwidth = results.reduce((sum, r) => sum + r.bandwidth, 0) / results.length;

    return { latency: avgLatency || 0, bandwidth: avgBandwidth || 0 };
  }, [debugSettings.enabled]);

  // Initialize network monitoring and event listeners
  useEffect(() => {
    if (!debugSettings.enabled) return;

    // Initial network check
    checkNetworkStatus();

    // Online/offline event handlers
    const handleOnline = () => setNetworkStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setNetworkStatus((prev) => ({ ...prev, isOnline: false }));

    // Modern event patterns - no unload handlers
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Use pagehide instead of unload for cleanup
    const handlePageHide = () => {
      if (debugSettings.enabled && apiCalls.length > 0) {
        const debugData = {
          timestamp: Date.now(),
          apiCalls: apiCalls.slice(0, 10), // Last 10 calls
          networkStatus
        };

        // Use sendBeacon for reliable data transmission
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(debugData)], { type: 'application/json' });
          navigator.sendBeacon('/api/debug/flush', blob);
        }
      }
    };

    window.addEventListener('pagehide', handlePageHide, { capture: true });

    // Periodic network checks
    networkCheckRef.current = window.setInterval(checkNetworkStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      if (networkCheckRef.current) clearInterval(networkCheckRef.current);
      if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    };
  }, [debugSettings.enabled, checkNetworkStatus, apiCalls, networkStatus]);

  // Create context value
  const contextValue: DebugContextType = {
    // Basic debug functionality
    debugMode: isDevelopment && debugSettings.enabled,
    logLevel: debugSettings.logLevel as any,
    enableNetworkLogging: debugSettings.enableNetworkLogging,
    enablePerformanceTracking: debugSettings.enablePerformanceTracking,
    addLog,
    clearLogs,
    getLogs,
    getDebugInfo,

    // Network status
    networkStatus,
    checkNetworkStatus,

    // API monitoring
    apiCalls,
    addApiCall,
    updateApiCall,
    clearApiCalls,

    // Debug settings
    debugSettings,
    updateDebugSettings,

    // Recovery tools
    retryFailedCall,
    clearCache,

    // Testing utilities
    simulateNetworkFailure,
    runNetworkBenchmark
  };

  // Return no-op in production if disabled
  if (!isDevelopment && !debugSettings.enabled) {
    return (
      <DebugContext.Provider value={createNoOpDebugContext()}>
        {children}
      </DebugContext.Provider>);

  }

  return (
    <DebugContext.Provider value={contextValue}>
      {children}
    </DebugContext.Provider>);

};

// Export types for use in components
export type { DebugContextType, DebugLog, DebugInfo, NetworkStatus, ApiCall, DebugSettings };