
import React, { useState, useEffect, ReactNode } from 'react';
import { NetworkProvider } from '@/contexts/NetworkContext';
import SafeErrorBoundary from './SafeErrorBoundary';
import { performNetworkHealthCheck, getNetworkHealthSummary, formatNetworkDiagnostics } from '@/utils/network-health-check';

interface SafeNetworkProviderProps {
  children: ReactNode;
  config?: {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
  };
}

export function SafeNetworkProvider({ children, config }: SafeNetworkProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeNetwork = async () => {
      try {
        console.log('[SafeNetworkProvider] Performing network health check...');
        
        const healthCheck = await performNetworkHealthCheck();
        
        if (healthCheck.isHealthy) {
          console.log('[SafeNetworkProvider] Network health check passed');
          console.log('[SafeNetworkProvider] Diagnostics:', formatNetworkDiagnostics(healthCheck));
          setIsInitialized(true);
        } else {
          const summary = getNetworkHealthSummary(healthCheck);
          console.warn('[SafeNetworkProvider] Network health check failed:', summary);
          console.warn('[SafeNetworkProvider] Issues:', healthCheck.issues);
          console.warn('[SafeNetworkProvider] Recommendations:', healthCheck.recommendations);
          console.log('[SafeNetworkProvider] Diagnostics:', formatNetworkDiagnostics(healthCheck));
          
          // Create a detailed error message
          const errorMessage = `${summary}\n\nIssues:\n${healthCheck.issues.join('\n')}\n\nRecommendations:\n${healthCheck.recommendations.join('\n')}`;
          
          setInitError(new Error(errorMessage));
        }
      } catch (error) {
        console.error('[SafeNetworkProvider] Health check failed:', error);
        setInitError(error instanceof Error ? error : new Error('Network initialization failed'));
      }
    };

    initializeNetwork();
  }, []);

  // Handle initialization errors
  if (initError) {
    return (
      <SafeErrorBoundary
        fallback={
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md mx-4">
              <div className="text-3xl text-amber-500">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900">
                Network Initialization Failed
              </h2>
              <p className="text-gray-600">
                The application failed to initialize network services. This might be due to browser compatibility issues or network restrictions.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setInitError(null);
                    setIsInitialized(false);
                    // Retry initialization
                    setTimeout(() => {
                      setIsInitialized(true);
                    }, 1000);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Retry Initialization
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <details className="text-left text-xs text-gray-500">
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                    {initError.message}
                    {'\n'}
                    {initError.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        }
      >
        {children}
      </SafeErrorBoundary>
    );
  }

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-sm">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600">Initializing network services...</p>
        </div>
      </div>
    );
  }

  // Wrap the NetworkProvider with error boundary for additional safety
  return (
    <SafeErrorBoundary
      resetKeys={[isInitialized]}
      onError={(error, errorInfo) => {
        console.error('[SafeNetworkProvider] NetworkProvider error:', error);
        console.error('[SafeNetworkProvider] Error info:', errorInfo);
        
        // If NetworkProvider fails, reset initialization to retry
        setTimeout(() => {
          setIsInitialized(false);
          setInitError(null);
          setTimeout(() => setIsInitialized(true), 1000);
        }, 2000);
      }}
    >
      <NetworkProvider config={config}>
        {children}
      </NetworkProvider>
    </SafeErrorBoundary>
  );
}

export default SafeNetworkProvider;
