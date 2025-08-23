import React, { ReactNode } from 'react';
import { NetworkProvider } from '@/contexts/NetworkContext';
import EnhancedNetworkErrorBoundary from './EnhancedNetworkErrorBoundary';

interface SafeNetworkProviderProps {
  children: ReactNode;
  config?: {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
  };
}

export function SafeNetworkProvider({ children, config }: SafeNetworkProviderProps) {
  // Wrap NetworkProvider with error boundary for production safety
  return (
    <EnhancedNetworkErrorBoundary fallback={
    <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-2xl text-gray-400">🔌</div>
          <h2 className="text-xl font-semibold text-gray-900">
            Network initialization failed
          </h2>
          <p className="text-gray-600">
            The app is running in offline-only mode.
          </p>
          <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">

            Retry
          </button>
        </div>
      </div>
    }>
      <NetworkProvider config={config}>
        {children}
      </NetworkProvider>
    </EnhancedNetworkErrorBoundary>);

}

export default SafeNetworkProvider;