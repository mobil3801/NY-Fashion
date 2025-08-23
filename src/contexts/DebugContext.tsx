
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { ApiError } from '@/lib/errors';

interface NetworkStatus {
  isOnline: boolean;
  latency: number | null;
  lastCheck: Date;
  connectionType?: string;
  downlink?: number;
}

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

interface DebugSettings {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxApiCalls: number;
  simulateNetworkConditions: 'none' | 'slow' | 'offline' | 'intermittent';
  retryOverrides: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}

interface DebugContextType {
  // Network status
  networkStatus: NetworkStatus;
  checkNetworkStatus: () => Promise<void>;
  
  // API monitoring
  apiCalls: ApiCall[];
  addApiCall: (call: Omit<ApiCall, 'id'>) => string;
  updateApiCall: (id: string, updates: Partial<ApiCall>) => void;
  clearApiCalls: () => void;
  
  // Debug settings
  debugSettings: DebugSettings;
  updateDebugSettings: (updates: Partial<DebugSettings>) => void;
  
  // Recovery tools
  retryFailedCall: (callId: string) => Promise<void>;
  clearCache: () => void;
  
  // Testing utilities
  simulateNetworkFailure: (duration: number) => void;
  runNetworkBenchmark: () => Promise<{ latency: number; bandwidth: number }>;
}

const DEFAULT_DEBUG_SETTINGS: DebugSettings = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'info',
  maxApiCalls: 100,
  simulateNetworkConditions: 'none',
  retryOverrides: {}
};

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};

interface DebugProviderProps {
  children: ReactNode;
}

export const DebugProvider: React.FC<DebugProviderProps> = ({ children }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    latency: null,
    lastCheck: new Date()
  });
  
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [debugSettings, setDebugSettings] = useState<DebugSettings>(DEFAULT_DEBUG_SETTINGS);
  
  const networkCheckRef = useRef<number>();
  const simulationTimeoutRef = useRef<number>();

  // Network status monitoring
  const checkNetworkStatus = useCallback(async (): Promise<void> => {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${window.location.origin}/api/health`, {
        method: 'HEAD',
        cache: 'no-cache'
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
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        latency: null,
        lastCheck: new Date()
      }));
    }
  }, []);

  // API call tracking
  const addApiCall = useCallback((call: Omit<ApiCall, 'id'>): string => {
    const id = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCall: ApiCall = { ...call, id };
    
    setApiCalls(prev => {
      const updated = [newCall, ...prev].slice(0, debugSettings.maxApiCalls);
      return updated;
    });
    
    return id;
  }, [debugSettings.maxApiCalls]);

  const updateApiCall = useCallback((id: string, updates: Partial<ApiCall>): void => {
    setApiCalls(prev => prev.map(call => 
      call.id === id ? { ...call, ...updates } : call
    ));
  }, []);

  const clearApiCalls = useCallback((): void => {
    setApiCalls([]);
  }, []);

  // Settings management
  const updateDebugSettings = useCallback((updates: Partial<DebugSettings>): void => {
    setDebugSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Recovery tools
  const retryFailedCall = useCallback(async (callId: string): Promise<void> => {
    const call = apiCalls.find(c => c.id === callId);
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
  }, [apiCalls, updateApiCall]);

  const clearCache = useCallback((): void => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear localStorage debug data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('debug_') || key.startsWith('api_')) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // Testing utilities
  const simulateNetworkFailure = useCallback((duration: number): void => {
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
  }, []);

  const runNetworkBenchmark = useCallback(async (): Promise<{ latency: number; bandwidth: number }> => {
    const testSizes = [1, 10, 100]; // KB
    const results = [];

    for (const size of testSizes) {
      const startTime = performance.now();
      
      try {
        const response = await fetch(`${window.location.origin}/api/benchmark?size=${size}`, {
          cache: 'no-cache'
        });
        
        const data = await response.text();
        const endTime = performance.now();
        const duration = endTime - startTime;
        const bandwidth = (size * 1024) / (duration / 1000); // bytes per second
        
        results.push({ latency: duration, bandwidth });
      } catch (error) {
        console.warn('Benchmark test failed for size:', size);
      }
    }

    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const avgBandwidth = results.reduce((sum, r) => sum + r.bandwidth, 0) / results.length;

    return { latency: avgLatency, bandwidth: avgBandwidth };
  }, []);

  // Initialize network monitoring
  useEffect(() => {
    if (!debugSettings.enabled) return;

    checkNetworkStatus();

    const handleOnline = () => setNetworkStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setNetworkStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic network checks
    networkCheckRef.current = window.setInterval(checkNetworkStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkCheckRef.current) clearInterval(networkCheckRef.current);
      if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
    };
  }, [debugSettings.enabled, checkNetworkStatus]);

  const value: DebugContextType = {
    networkStatus,
    checkNetworkStatus,
    apiCalls,
    addApiCall,
    updateApiCall,
    clearApiCalls,
    debugSettings,
    updateDebugSettings,
    retryFailedCall,
    clearCache,
    simulateNetworkFailure,
    runNetworkBenchmark
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};
