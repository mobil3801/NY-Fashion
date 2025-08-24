
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import ConnectionQualityIndicator from '@/components/network/ConnectionQualityIndicator';
import { OfflineBanner } from '@/components/network/OfflineBanner';
import EnhancedNetworkErrorBoundary from '@/components/network/EnhancedNetworkErrorBoundary';
import SafeErrorBoundary from '@/components/network/SafeErrorBoundary';
import ContentLoader from '@/components/common/ContentLoader';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from './Header';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  className?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ className = '' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutError, setLayoutError] = useState<Error | null>(null);
  const [isContentReady, setIsContentReady] = useState(false);

  // Use the dedicated mobile hook instead of custom implementation
  const isMobile = useIsMobile();

  // Error boundary for layout-specific errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.filename?.includes('MainLayout')) {
        setLayoutError(event.error);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        setLayoutError(event.reason);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialize content readiness
  useEffect(() => {
    const initializeContent = async () => {
      try {
        // Simulate content initialization
        await new Promise((resolve) => setTimeout(resolve, 100));
        setIsContentReady(true);
      } catch (error) {
        setLayoutError(error instanceof Error ? error : new Error('Content initialization failed'));
      }
    };

    initializeContent();
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
    setIsContentReady(false);
    // Re-initialize content
    setTimeout(() => {
      setIsContentReady(true);
    }, 100);
  }, []);

  // Error fallback UI for layout-specific errors
  const renderLayoutError = () =>
  <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
      <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="text-3xl text-red-500">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900">Layout Error</h2>
        <p className="text-gray-600 text-sm">
          {layoutError?.message || 'An error occurred while rendering the layout'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
          onClick={resetLayoutError}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
            Retry
          </button>
          <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm">
            Reload Page
          </button>
        </div>
      </div>
    </div>;


  // Render layout error if one occurred
  if (layoutError) {
    return renderLayoutError();
  }

  // Show loading state while content is initializing
  if (!isContentReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <ContentLoader
          isLoading={true}
          loadingMessage="Initializing application..."
          className="min-h-[200px]" />
      </div>);

  }

  return (
    <SafeErrorBoundary
      resetKeys={[isMobile, sidebarOpen]}
      resetOnPropsChange={false}
      onError={(error, errorInfo) => {


        // Error logging removed for production
      }}>
      <EnhancedNetworkErrorBoundary>
        <div className={`flex h-screen bg-gray-50 ${className}`.trim()}>
          {/* Enhanced Offline Banner - Global network status with improved UX */}
          <OfflineBanner />

          {/* Sidebar with proper mobile handling */}
          <Sidebar isOpen={isMobile ? sidebarOpen : true} onClose={closeSidebar}
            className="transition-transform duration-200 ease-in-out" />

          {/* Main content wrapper with responsive margins */}
          <div className={`
            flex flex-col flex-1 min-w-0
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
                <ContentLoader
                  hasError={true}
                  errorTitle="Content Loading Error"
                  errorMessage="Failed to load this section. This might be a temporary network issue."
                  isNetworkError={true}
                  onRetry={() => window.location.reload()}
                  onReload={() => window.location.reload()}
                  className="h-full min-h-[50vh]"
                  autoRetry={true}
                  maxAutoRetries={3}
                  showNetworkStatus={true} />
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
      </EnhancedNetworkErrorBoundary>
    </SafeErrorBoundary>);

};

export default MainLayout;