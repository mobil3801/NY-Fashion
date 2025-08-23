import React from 'react';
import { Outlet } from 'react-router-dom';
import DebugFloatingButton from '@/components/debug/DebugFloatingButton';
import ConnectionQualityIndicator from '@/components/network/ConnectionQualityIndicator';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import EnhancedNetworkErrorBoundary from '@/components/network/EnhancedNetworkErrorBoundary';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC = () => {
  return (
    <EnhancedNetworkErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        {/* Enhanced Offline Banner - Global network status with improved UX */}
        <OfflineBanner />
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main content wrapper */}
        <div className="flex flex-col flex-1">
          {/* Header */}
          <Header />

          {/* Main content with enhanced error boundary */}
          <main
            className="flex-1 overflow-y-auto p-6"
            role="main"
            aria-label="Main content">

            <EnhancedNetworkErrorBoundary fallback={
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="text-2xl text-gray-400">⚠️</div>
                  <p className="text-gray-600">Failed to load this section</p>
                  <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">

                    Reload
                  </button>
                </div>
              </div>
            }>
              <Outlet />
            </EnhancedNetworkErrorBoundary>
          </main>
        </div>

        {/* Enhanced Network Connection Quality Indicator with accessibility */}
        <div
          className="fixed bottom-4 left-4 z-40"
          role="status"
          aria-live="polite"
          aria-label="Network connection status">

          <ConnectionQualityIndicator variant="full" showDetails={true} />
        </div>

        {/* Debug Tools - Development Only with safe rendering */}
        {process.env.NODE_ENV === 'development' &&
        <DebugFloatingButton />
        }
      </div>
    </EnhancedNetworkErrorBoundary>);

};

export default MainLayout;