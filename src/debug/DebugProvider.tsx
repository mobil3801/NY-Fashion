import React, { createContext, useContext, ReactNode } from 'react';

// Debug context interface
interface DebugContextType {
  debugMode: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  enableNetworkLogging: boolean;
  enablePerformanceTracking: boolean;
  addLog: (level: string, message: string, data?: unknown) => void;
  clearLogs: () => void;
  getLogs: () => DebugLog[];
  getDebugInfo: () => DebugInfo;
}

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

// Create context with safe defaults
const DebugContext = createContext<DebugContextType | null>(null);

// Production-safe no-op implementation
const createNoOpDebugContext = (): DebugContextType => ({
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
    timestamp: Date.now(),
  }),
});

// Development debug implementation
const createDevDebugContext = (): DebugContextType => {
  const logs: DebugLog[] = [];
  
  return {
    debugMode: true,
    logLevel: 'debug',
    enableNetworkLogging: true,
    enablePerformanceTracking: true,
    
    addLog: (level: string, message: string, data?: unknown) => {
      const log: DebugLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        level,
        message,
        data,
      };
      
      logs.push(log);
      
      // Keep only last 1000 logs to prevent memory issues
      if (logs.length > 1000) {
        logs.shift();
      }
      
      // Also log to console in development
      if (console[level as keyof Console]) {
        (console[level as keyof Console] as (...args: unknown[]) => void)(
          `[Debug] ${message}`,
          data || ''
        );
      }
    },
    
    clearLogs: () => {
      logs.splice(0, logs.length);
    },
    
    getLogs: () => [...logs],
    
    getDebugInfo: () => ({
      environment: process.env.NODE_ENV || 'development',
      buildMode: import.meta.env?.MODE || 'development',
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      memoryUsage: (performance as any)?.memory,
    }),
  };
};

interface DebugProviderProps {
  children: ReactNode;
}

export const DebugProvider: React.FC<DebugProviderProps> = ({ children }) => {
  // Environment-aware context creation
  const debugContext = React.useMemo(() => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    return isDevelopment ? createDevDebugContext() : createNoOpDebugContext();
  }, []);

  return (
    <DebugContext.Provider value={debugContext}>
      {children}
    </DebugContext.Provider>
  );
};

// Custom hook with error boundary
export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  
  if (!context) {
    // Return safe defaults if provider is missing
    console.warn('[DebugProvider] useDebug called outside of DebugProvider');
    return createNoOpDebugContext();
  }
  
  return context;
};

// Export default for backward compatibility
export default DebugProvider;
