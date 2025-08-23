import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import DebugFloatingButton from '@/components/debug/DebugFloatingButton';
import ConnectionQualityIndicator from '@/components/network/ConnectionQualityIndicator';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import EnhancedNetworkErrorBoundary from '@/components/network/EnhancedNetworkErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from './Header';
import Sidebar from './Sidebar';

// Environment configuration with fallbacks
const getEnvironmentConfig = () => ({
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  enableDebugTools: process.env.REACT_APP_ENABLE_DEBUG === 'true' || process.env.NODE_ENV === 'development'
});

interface MainLayoutProps {
  className?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ className = '' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutError, setLayoutError] = useState<Error | null>(null);

  // Use the dedicated mobile hook instead of custom implementation
  const isMobile = useIsMobile();

  // Environment configuration
  const envConfig = useMemo(() => getEnvironmentConfig(), []);

  // Error boundary for layout-specific errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.filename?.includes('MainLayout')) {
        console.error('[MainLayout] JavaScript error detected:', event.error);
        setLayoutError(event.error);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Enhanced responsive behavior with better performance
  useEffect(() => {
    // Auto-close sidebar on desktop when switching from mobile
    if (!isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Optimized sidebar toggle handlers
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Handle layout errors gracefully
  const resetLayoutError = useCallback(() => {
    setLayoutError(null);
  }, []);

  // Error fallback UI for layout-specific errors
  const renderLayoutError = () =>
  <div
    className="flex items-center justify-center h-screen bg-gray-50">


      <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md mx-4">
        <div className="text-3xl text-red-500">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900">Layout Error</h2>
        <p className="text-gray-600">
          {layoutError?.message || 'An error occurred while rendering the layout'}
        </p>
        <div className="flex gap-2 justify-center">
          <button
          onClick={resetLayoutError}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">

            Retry
          </button>
          <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">

            Reload Page
          </button>
        </div>
      </div>
    </div>;


  // Render layout error if one occurred
  if (layoutError) {
    return renderLayoutError();
  }

  return (
    <EnhancedNetworkErrorBoundary>



      <div
        className={`flex h-screen bg-gray-50 ${className}`.trim()}>



        {/* Enhanced Offline Banner - Global network status with improved UX */}
        <OfflineBanner />



        
        {/* Sidebar with proper mobile handling */}
        <Sidebar
          isOpen={isMobile ? sidebarOpen : true}
          onClose={closeSidebar}
          className={`
            ${isMobile ? 'lg:translate-x-0' : ''}
            transition-transform duration-200 ease-in-out
          `.trim()} />




        {/* Main content wrapper with responsive margins */}
        <div
          className={`
            flex flex-col flex-1
            ${isMobile ? 'ml-0' : 'lg:ml-0'}
            transition-all duration-200 ease-in-out
          `.trim()}>



          {/* Header with enhanced props */}
          <Header
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
            isMobile={isMobile} />




          {/* Main content with enhanced error boundary and accessibility */}
          <main
            className="flex-1 overflow-y-auto p-4 sm:p-6"
            role="main"
            aria-label="Main content">



            <EnhancedNetworkErrorBoundary
              fallback={
              <div
                className="flex items-center justify-center h-full min-h-[50vh]">



                  <div
                  className="text-center space-y-4 p-6 bg-white rounded-lg shadow-sm max-w-md mx-4">



                    <div
                    className="text-3xl text-amber-500">



                      ⚠️
                    </div>
                    <h3
                    className="text-lg font-semibold text-gray-900">



                      Content Loading Error
                    </h3>
                    <p
                    className="text-gray-600 text-sm">



                      Failed to load this section. This might be a temporary network issue.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex-1">



                        Reload Page
                      </button>
                      <button
                      onClick={() => window.history.back()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex-1">



                        Go Back
                      </button>
                    </div>
                  </div>
                </div>
              }>



              <Outlet />



            </EnhancedNetworkErrorBoundary>
          </main>
        </div>

        {/* Enhanced Network Connection Quality Indicator with accessibility */}
        <div
          className="fixed bottom-4 left-4 z-40 pointer-events-auto"
          role="status"
          aria-live="polite"
          aria-label="Network connection status">



          <ConnectionQualityIndicator
            variant="full"
            showDetails={true} />



        </div>

        {/* Debug Tools - Development Only with safe rendering and environment checks */}
        {envConfig.enableDebugTools &&
        <DebugFloatingButton />



        }

        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarOpen &&
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              closeSidebar();
            }
          }} />



        }
      </div>
    </EnhancedNetworkErrorBoundary>);

};

export default MainLayout;